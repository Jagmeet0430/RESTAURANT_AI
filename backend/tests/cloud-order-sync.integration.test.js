import assert from "node:assert/strict";
import { test, mock } from "node:test";
import fs from "node:fs/promises";
import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";
import pg from "pg";
import dotenv from "dotenv";
import express from "express";
import jwt from "jsonwebtoken";
import { cloudSyncConfig } from "../src/config/cloudSyncConfig.js";

test("cloud sync configuration is opt-in and HTTPS-only", () => {
  assert.deepEqual(cloudSyncConfig({}), { enabled: false });
  const env = { CLOUD_SYNC_ENABLED: "true", CLOUD_SYNC_SECRET: "s".repeat(48) };
  assert.equal(cloudSyncConfig(env).intervalMs, 10000);
  assert.throws(() => cloudSyncConfig({ ...env, CLOUD_SYNC_SECRET: "short" }));
  for (const url of ["http://example.com/api", "https://user:password@example.com/api", "https://example.com/api?secret=x"]) {
    assert.throws(() => cloudSyncConfig({ ...env, CLOUD_SYNC_BASE_URL: url }));
  }
});

// Requires local PostgreSQL CREATE DATABASE permission. Only these randomly
// named fixture databases are written/dropped; restaurant_db is never opened.
test("cloud-to-local order sync with two disposable PostgreSQL databases", { timeout: 120000 }, async t => {
  const env = dotenv.parse(await fs.readFile(new URL("../.env", import.meta.url)));
  const connection = { host: "127.0.0.1", port: Number(env.DB_PORT || 5432),
    user: env.DB_USER || "postgres", password: env.DB_PASSWORD, connectionTimeoutMillis: 3000 };
  const admin = new pg.Pool({ ...connection, database: "postgres" });
  const created = [], pools = [], servers = [], workers = [];
  const prefix = `restaurantai_sync_test_${Date.now()}`;
  const logs = [];
  const log = { warn: (message, metadata) => logs.push({ message, ...metadata }) };
  const secret = crypto.randomBytes(32).toString("hex");
  const context = new AsyncLocalStorage();
  let local, cloud;
  try {
    const bootstrap = (await fs.readFile(new URL("../database/bootstrap/offline_v1_schema.sql", import.meta.url), "utf8"))
      .split(/\r?\n/).filter(line => !line.startsWith("\\")).join("\n");
    for (const side of ["cloud", "local"]) {
      const name = `${prefix}_${side}`;
      assert.match(name, /^restaurantai_sync_test_\d+_(cloud|local)$/);
      await admin.query(`CREATE DATABASE "${name}"`);
      created.push(name);
      const db = new pg.Pool({ ...connection, database: name });
      pools.push(db);
      const client = await db.connect();
      try {
        await client.query(bootstrap);
        await client.query("SET search_path = public");
        for (const file of ["014_table_qr_ordering.sql", "015_billing_receipts_settlement.sql", "016_cloud_order_sync.sql", "016_cloud_order_sync.sql"]) {
          await client.query(await fs.readFile(new URL(`../database/migrations/${file}`, import.meta.url), "utf8"));
        }
      } finally { client.release(); }
      await db.query("INSERT INTO admins(name,email,role) VALUES ('Fixture','fixture@example.invalid','admin')");
      await db.query("INSERT INTO categories(name) VALUES ('Snacks')");
      const menuId = side === "local" ? 77 : 1;
      await db.query(`INSERT INTO menu(id, category_id, name, price, veg_type, barcode)
        VALUES ($1,1,'Fixture Roll',$2,'veg','SYNC-FIXTURE-ROLL')`, [menuId, side === "local" ? 200 : 90]);
      await db.query("INSERT INTO customers(name,phone) VALUES ('Sync Fixture','+919876543210')");
      if (side === "local") {
        await db.query(`INSERT INTO inventory(ingredient_name, quantity, unit, menu_id, stock_per_sale)
          VALUES ('Fixture Roll',100,'piece',77,1)`);
        local = db;
      } else cloud = db;
    }
    Object.assign(process.env, { RESTAURANTAI_MODE: "online", NODE_ENV: "test", WHATSAPP_ENABLED: "false",
      JWT_SECRET: "isolated-cloud-sync-test-secret", PUBLIC_ORDER_OTP_REQUIRED: "false" });
    mock.module("../src/config/database.js", { namedExports: { pool: {
      query: (...args) => (context.getStore() || local).query(...args),
      connect: (...args) => (context.getStore() || local).connect(...args),
    } } });
    // Exercise kiosk order creation without accessing the installed printer or
    // its ProgramData print ledger from this disposable database fixture.
    mock.module("../src/services/kioskReceiptAutoPrintService.js", { namedExports: { requestKioskReceiptAutoPrint: () => {} } });
    const { createCloudSyncRouter } = await import("../src/routes/cloudSyncRoutes.js");
    const { createCloudOrderSyncWorker } = await import("../src/services/cloudOrderSyncService.js");
    const { importCloudOrder } = await import("../src/services/cloudOrderImportService.js");
    const { createCashOrder } = await import("../src/controllers/paymentController.js");
    const { getTrackedOrder } = await import("../src/controllers/orderTrackingController.js");
    const { payOrder } = await import("../src/services/billingService.js");
    const { default: orderRoutes } = await import("../src/routes/orderRoutes.js");
    const { default: kitchenRoutes } = await import("../src/routes/kitchenRoutes.js");
    const { default: adminRoutes } = await import("../src/routes/adminOrderRoutes.js");
    const app = express();
    app.use(express.json());
    app.locals.pool = local;
    app.use("/api/sync", createCloudSyncRouter({ db: cloud, mode: "online", secret: () => secret }));
    app.use("/local-sync", createCloudSyncRouter({ db: local, mode: "local", secret: () => secret }));
    app.post("/public-order", (req, res) => context.run(cloud, () => createCashOrder(req, res)));
    app.post("/local-order", createCashOrder);
    app.get("/track/:trackingToken", (req, res, next) => context.run(cloud, () => getTrackedOrder(req, res, next)));
    app.use("/api/orders", orderRoutes);
    app.use("/api/kitchen", kitchenRoutes);
    app.use("/api/admin/orders", adminRoutes);
    const server = await new Promise(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
    servers.push(server);
    const base = `http://127.0.0.1:${server.address().port}`;
    const auth = jwt.sign({ id: 1, role: "admin" }, process.env.JWT_SECRET);
    const api = async (path, body, method = "POST", token = auth) => {
      const response = await fetch(base + path, { method: body === undefined ? "GET" : method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, body: await response.json() };
    };
    let offline = false, loseAck = false, loseStatus = false, slow = false, active = 0, maxActive = 0;
    const config = cloudSyncConfig({ CLOUD_SYNC_ENABLED: "true", CLOUD_SYNC_SECRET: secret,
      CLOUD_SYNC_BASE_URL: "https://cloud.fixture.invalid/api" });
    const fetchImpl = async (url, options) => {
      assert.ok(url.startsWith("https://cloud.fixture.invalid/api/sync/"));
      assert.equal(options.redirect, "error");
      if (offline) throw new Error(`sensitive provider failure ${secret}`);
      active++; maxActive = Math.max(maxActive, active);
      try {
        if (slow) await new Promise(resolve => setTimeout(resolve, 40));
        const response = await fetch(url.replace("https://cloud.fixture.invalid", base), options);
        if (loseAck && url.endsWith("/ack")) { loseAck = false; throw new Error("Lost ACK response"); }
        if (loseStatus && url.endsWith("/status")) { loseStatus = false; throw new Error("Lost status response"); }
        return response;
      } finally { active--; }
    };
    let worker = createCloudOrderSyncWorker({ db: local, config, fetchImpl, log });
    workers.push(worker);
    const websiteOrder = async (overrides = {}) => {
      const response = await api("/public-order", { customer_id: 1, order_type: "pickup", order_source: "customer_web",
        payment_method: "pay_at_counter", idempotency_key: crypto.randomUUID(), items: [{ menu_id: 1, quantity: 2 }], ...overrides });
      assert.equal(response.status, 201, response.body.message);
      return response.body.data.order;
    };
    const localOrder = async cloudId => (await local.query("SELECT * FROM orders WHERE cloud_order_id = $1", [cloudId])).rows[0];
    let original, imported;
    await t.test("real public checkout creates a website order; invalid secret and browser origin rejected", async () => {
      original = await websiteOrder();
      assert.equal(original.order_source, "website");
      assert.equal((await api("/api/sync/orders/pending", undefined, "GET", "wrong")).status, 401);
      assert.equal((await api("/local-sync/orders/pending", undefined, "GET", secret)).status, 404);
      const browserResponse = await fetch(base + "/api/sync/orders/pending", { headers: { Authorization: `Bearer ${secret}`, Origin: "https://website.invalid" } });
      assert.equal(browserResponse.status, 401);
      const pending = await api("/api/sync/orders/pending", undefined, "GET", secret);
      assert.equal(pending.status, 200);
      assert.equal(pending.body.data.orders[0].cloud_order_id, original.id);
    });
    await t.test("one import preserves cloud totals/time and maps different IDs by barcode", async () => {
      loseAck = true;
      await worker.tick();
      imported = await localOrder(original.id);
      assert.ok(imported);
      assert.equal(imported.order_source, "website");
      assert.equal(Number(imported.total_amount), 199);
      assert.equal(new Date(imported.created_at).getTime(), new Date(original.created_at).getTime());
      assert.equal(imported.cloud_synced_at, null, "lost ACK response remains retryable locally");
      assert.equal((await local.query("SELECT menu_id FROM order_items WHERE order_id=$1", [imported.id])).rows[0].menu_id, 77);
      assert.equal(Number((await local.query("SELECT quantity FROM inventory WHERE menu_id=77")).rows[0].quantity), 98);
      assert.equal((await local.query("SELECT * FROM bills WHERE order_id=$1", [imported.id])).rowCount, 1);
    });
    await t.test("ACK recovery, concurrent ticks and repeated imports never duplicate", async () => {
      slow = true;
      await Promise.all([worker.tick(), worker.tick(), worker.tick()]);
      slow = false;
      assert.equal(maxActive, 1);
      assert.ok((await localOrder(original.id)).cloud_synced_at);
      assert.equal((await local.query("SELECT * FROM orders WHERE cloud_order_id=$1", [original.id])).rowCount, 1);
      assert.equal(Number((await local.query("SELECT quantity FROM inventory WHERE menu_id=77")).rows[0].quantity), 98);
    });
    await t.test("existing authenticated Admin and Kitchen APIs show unpaid website order", async () => {
      const adminOrders = await api("/api/orders");
      assert.equal(adminOrders.status, 200);
      assert.ok(adminOrders.body.data.some(order => order.id === imported.id));
      const kitchen = await api("/api/kitchen/orders");
      assert.equal(kitchen.status, 200);
      assert.ok(kitchen.body.data.some(order => order.id === imported.id && order.payment_status === "Pending"));
      assert.equal((await api("/api/kitchen/orders", undefined, "GET", "wrong")).status, 401);
    });
    await t.test("offline changes remain local; ordered events survive worker restart and update cloud tracking", async () => {
      offline = true;
      for (const status of ["Accepted", "Preparing", "Ready", "Completed"]) {
        const response = await api(`/api/kitchen/orders/${imported.id}/status`, { status }, "PUT");
        assert.equal(response.status, 200, response.body.message);
      }
      await worker.tick();
      assert.equal((await localOrder(original.id)).status, "Completed");
      assert.equal((await cloud.query("SELECT status FROM orders WHERE id=$1", [original.id])).rows[0].status, "Confirmed");
      await worker.stop();
      worker = createCloudOrderSyncWorker({ db: local, config, fetchImpl, log }); workers.push(worker);
      offline = false;
      await local.query("UPDATE cloud_order_sync_events SET next_attempt_at=CURRENT_TIMESTAMP");
      for (const status of ["Accepted", "Preparing", "Ready", "Completed"]) {
        await worker.tick();
        const tracked = await api(`/track/${original.tracking_token}`);
        assert.equal(tracked.status, 200);
        assert.equal(tracked.body.data.statusLabel, status);
      }
      assert.equal((await local.query("SELECT * FROM cloud_order_sync_events WHERE delivered_at IS NULL")).rowCount, 0);
    });
    await t.test("payment sync reuses cloud billing; lost response is safely replayed", async () => {
      const client = await local.connect();
      try {
        await client.query("BEGIN");
        await payOrder(client, { orderId: imported.id, paymentMethod: "cash" });
        await client.query("COMMIT");
      } finally { client.release(); }
      loseStatus = true;
      await worker.tick();
      assert.equal((await cloud.query("SELECT payment_status FROM orders WHERE id=$1", [original.id])).rows[0].payment_status, "Paid");
      await local.query("UPDATE cloud_order_sync_events SET next_attempt_at=CURRENT_TIMESTAMP WHERE delivered_at IS NULL");
      await worker.tick();
      assert.equal((await cloud.query("SELECT * FROM payments WHERE order_id=$1 AND payment_status='paid'", [original.id])).rowCount, 1);
      assert.equal((await local.query("SELECT * FROM cloud_order_sync_events WHERE delivered_at IS NULL")).rowCount, 0);
    });
    await t.test("unmapped item stays pending; reconnect retries it; concurrent imports create one order", async () => {
      const next = await websiteOrder();
      await local.query("UPDATE menu SET barcode='LOCAL-UNMAPPED' WHERE id=77");
      await worker.tick();
      assert.equal(await localOrder(next.id), undefined);
      assert.equal((await cloud.query("SELECT cloud_synced_at FROM orders WHERE id=$1", [next.id])).rows[0].cloud_synced_at, null);
      await local.query("UPDATE menu SET barcode='SYNC-FIXTURE-ROLL' WHERE id=77");
      const pending = await api("/api/sync/orders/pending", undefined, "GET", secret);
      const order = pending.body.data.orders.find(value => value.cloud_order_id === next.id);
      const imports = await Promise.all([importCloudOrder(local, order, config.baseUrl), importCloudOrder(local, order, config.baseUrl)]);
      assert.equal(imports.filter(value => value.duplicate).length, 1);
      await worker.tick();
      const row = await localOrder(next.id);
      assert.ok(row.cloud_synced_at);
      const cancelled = await api(`/api/admin/orders/${row.id}/status`, { status: "Cancelled", cancellationReason: "Fixture cancellation" }, "PATCH");
      assert.equal(cancelled.status, 200);
      await worker.tick();
      assert.equal((await api(`/track/${next.tracking_token}`)).body.data.statusLabel, "Cancelled");
    });
    await t.test("ID/name mismatches, total corruption and unique constraints prevent unsafe imports", async () => {
      const next = await websiteOrder();
      const data = (await api("/api/sync/orders/pending", undefined, "GET", secret)).body.data.orders.find(order => order.cloud_order_id === next.id);
      await assert.rejects(importCloudOrder(local, { ...data, total_amount: 1 }, config.baseUrl), { code: "SYNC_TOTAL_MISMATCH" });
      await assert.rejects(importCloudOrder(local, { ...data, items: data.items.map(item => ({ ...item, barcode: null, name: "Different item" })) }, config.baseUrl), { code: "SYNC_MENU_MAPPING_FAILED" });
      const fallback = await importCloudOrder(local, { ...data, items: data.items.map(item => ({ ...item, barcode: null })) }, config.baseUrl);
      assert.ok(fallback.order.id);
      await assert.rejects(local.query("UPDATE orders SET cloud_order_id=$1 WHERE id=$2", [original.id, fallback.order.id]), { code: "23505" });
      assert.equal(JSON.stringify(logs).includes(secret), false);
      assert.equal(JSON.stringify(logs).includes("9876543210"), false);
      assert.ok(logs.some(entry => entry.code === "SYNC_BARCODE_MAPPING_FAILED"));
    });
    await t.test("local kiosk remains operational offline and does not enter the sync queue", async () => {
      offline = true;
      const queued = (await local.query("SELECT COUNT(*) AS n FROM cloud_order_sync_events")).rows[0].n;
      const response = await api("/local-order", { customer_id: 1, order_type: "dine_in", order_source: "kiosk",
        payment_method: "pay_at_counter", items: [{ menu_id: 77, quantity: 1 }], idempotency_key: crypto.randomUUID() });
      assert.equal(response.status, 201, response.body.message);
      assert.equal(response.body.data.order.cloud_order_id, null);
      assert.equal(response.body.data.order.order_source, "kiosk");
      await worker.tick();
      assert.equal((await local.query("SELECT COUNT(*) AS n FROM cloud_order_sync_events")).rows[0].n, queued);
      assert.equal((await api("/api/kitchen/orders")).status, 200);
      offline = false;
    });
    await t.test("unpaid online payments wait; paid orders import without recharging; non-website sources excluded", async () => {
      const next = await websiteOrder();
      await cloud.query("UPDATE orders SET payment_method='Razorpay Card' WHERE id=$1", [next.id]);
      await worker.tick();
      assert.equal(await localOrder(next.id), undefined);
      await cloud.query("UPDATE orders SET payment_status='Paid', paid_at=CURRENT_TIMESTAMP WHERE id=$1", [next.id]);
      await worker.tick();
      const paid = await localOrder(next.id);
      assert.equal(paid.payment_status, "Paid");
      assert.equal(Number(paid.total_amount), 199);
      assert.equal((await local.query("SELECT payment_status FROM bills WHERE order_id=$1", [paid.id])).rows[0].payment_status, "Paid");
      for (const source of ["kiosk", "table_qr", "pos"]) {
        const excluded = await websiteOrder({ order_source: source });
        await worker.tick();
        assert.equal(await localOrder(excluded.id), undefined);
      }
    });
    await t.test("cloud rejects version gaps, foreign local IDs and terminal regressions", async () => {
      const row = (await cloud.query("SELECT * FROM orders WHERE id=$1", [original.id])).rows[0];
      const body = { local_order_id: imported.id, version: Number(row.cloud_sync_version) + 2,
        status: "Completed", payment_status: "Paid", payment_method: "Cash" };
      const route = `/api/sync/orders/${original.id}/status`;
      assert.equal((await api(route, body, "PATCH", secret)).body.code, "SYNC_VERSION_GAP");
      assert.equal((await api(route, { ...body, local_order_id: 99999 }, "PATCH", secret)).body.code, "SYNC_ORDER_NOT_ACKNOWLEDGED");
      assert.equal((await api(route, { ...body, version: Number(row.cloud_sync_version) + 1, status: "Preparing" }, "PATCH", secret)).status, 409);
      assert.equal((await cloud.query("SELECT status FROM orders WHERE id=$1", [original.id])).rows[0].status, "Completed");
    });
    await t.test("shutdown aborts a pending request and prevents subsequent ticks", async () => {
      let started;
      const requestStarted = new Promise(resolve => { started = resolve; });
      const blocked = createCloudOrderSyncWorker({ db: local, config, log, fetchImpl: (_url, { signal }) => {
        started();
        return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("Aborted")), { once: true }));
      } });
      workers.push(blocked);
      const tick = blocked.tick();
      await requestStarted;
      await blocked.stop();
      await tick;
      await blocked.tick();
    });
  } finally {
    for (const worker of workers) await worker.stop();
    for (const server of servers) {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
    for (const db of pools) await db.end();
    for (const name of created) {
      assert.match(name, /^restaurantai_sync_test_\d+_(cloud|local)$/);
      await admin.query(`DROP DATABASE "${name}"`);
    }
    await admin.end();
  }
});
