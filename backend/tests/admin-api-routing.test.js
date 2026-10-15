import assert from "node:assert/strict";
import { test, mock } from "node:test";
import jwt from "jsonwebtoken";

test("Admin API boundary, authentication, live cache and source-neutral order query", async t => {
  Object.assign(process.env, {
    NODE_ENV: "test", RESTAURANTAI_MODE: "local", WHATSAPP_ENABLED: "false",
    JWT_SECRET: "admin-routing-isolated-test-secret",
  });
  const sources = ["website", "customer_web", "kiosk", "pos", "table_qr", "local", "future_source"];
  const orders = sources.map((order_source, index) => ({
    id: 97 - index, order_source, status: index === 6 ? "Pending" : "Confirmed",
    order_number: `FIXTURE-${97 - index}`,
  }));
  let listQueries = 0;
  // Never connect to or write the live restaurant database.
  mock.module("../src/config/database.js", { namedExports: { pool: {
    query: async (sql, params) => {
      if (sql.includes("GROUP BY o.id, c.id, wn.delivery_status")) {
        listQueries++;
        assert.match(sql, /ORDER BY o.created_at DESC, o.id DESC LIMIT/);
        assert.doesNotMatch(sql.slice(sql.indexOf("WHERE 1=1")), /order_source|cloud_order_id|cloud_sync_status/);
        assert.deepEqual(params.slice(-2), [50, 0]);
        return { rows: orders, rowCount: orders.length };
      }
      return { rows: [], rowCount: 0 };
    },
    connect: async () => ({
      query: async () => ({ rows: [], rowCount: 0 }),
      release() {},
    }),
  } } });
  const { default: app } = await import("../src/app.js");
  const server = await new Promise(resolve => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const authorization = `Bearer ${jwt.sign({ id: 1, role: "admin" }, process.env.JWT_SECRET)}`;
  try {
    await t.test("unknown API routes return JSON, never the SPA", async () => {
      for (const path of ["/api", "/api/", "/api/nonexistent-test-route", "/api/admin/nonexistent-test-route"]) {
        const response = await fetch(base + path);
        assert.equal(response.status, 404, path);
        assert.match(response.headers.get("content-type"), /application\/json/);
        assert.deepEqual(await response.json(), { success: false, message: "API route not found" });
      }
    });
    await t.test("Admin deep link is HTML, with static caching unchanged", async () => {
      const response = await fetch(base + "/admin/orders");
      assert.equal(response.status, 200, "Build Admin before running this test");
      assert.match(response.headers.get("content-type"), /text\/html/);
      assert.match(await response.text(), /<title>admin<\/title>/);
      assert.notEqual(response.headers.get("cache-control"), "no-store");
    });
    await t.test("orders remain protected and auth errors are JSON", async () => {
      const response = await fetch(base + "/api/orders");
      assert.equal(response.status, 401);
      assert.equal((await response.json()).success, false);
      assert.equal(listQueries, 0);
    });
    await t.test("authenticated orders include all sources and never return stale 304", async () => {
      const first = await fetch(base + "/api/orders", { headers: { authorization } });
      assert.equal(first.status, 200);
      assert.equal(first.headers.get("cache-control"), "no-store");
      assert.deepEqual((await first.json()).data, orders);
      const second = await fetch(base + "/api/orders", { headers: {
        authorization, "If-None-Match": first.headers.get("etag"),
        "If-Modified-Since": new Date().toUTCString(),
      } });
      assert.equal(second.status, 200);
      assert.deepEqual((await second.json()).data, orders);
      assert.equal(listQueries, 2);
    });
    await t.test("next poll sees a newly available website order without restart", async () => {
      orders.unshift({ id: 98, order_source: "website", status: "Confirmed" });
      const response = await fetch(base + "/api/orders", { headers: { authorization } });
      assert.equal((await response.json()).data[0].id, 98);
    });
    await t.test("health remains an API route ahead of the SPA boundary", async () => {
      const response = await fetch(base + "/api/health");
      assert.equal(response.status, 200);
      assert.equal((await response.json()).database, "connected");
    });
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
