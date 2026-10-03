import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
process.env.OTP_SECRET = process.env.OTP_SECRET || crypto.randomBytes(32).toString("hex");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendEnv = path.resolve(__dirname, "../.env");
const programDataEnv = path.join(process.env.ProgramData || "C:\\ProgramData", "RestaurantAI", "config", ".env");

try {
  await fs.access(backendEnv);
  process.env.RESTAURANTAI_ENV_PATH = process.env.RESTAURANTAI_ENV_PATH || backendEnv;
} catch {
  try {
    await fs.access(programDataEnv);
    process.env.RESTAURANTAI_ENV_PATH = process.env.RESTAURANTAI_ENV_PATH || programDataEnv;
  } catch {
    // Let the app use its default env loading path.
  }
}

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "restaurantai-kiosk-print-"));
const configDir = path.join(tempRoot, "config");
const runtimeDir = path.join(tempRoot, "runtime");
const printRecordPath = path.join(tempRoot, "print-events.jsonl");
const mockPrintScriptPath = path.join(tempRoot, "mock-print-receipt.ps1");

process.env.RESTAURANTAI_STATE_ROOT = tempRoot;
process.env.RESTAURANTAI_PRINT_SCRIPT = mockPrintScriptPath;
process.env.RESTAURANTAI_PRINT_TEST_RECORD = printRecordPath;

await fs.mkdir(configDir, { recursive: true });
await fs.mkdir(runtimeDir, { recursive: true });
await fs.writeFile(
  mockPrintScriptPath,
  [
    "param([string]$JobPath = '', [string]$ConfigPath = '')",
    "$ErrorActionPreference = 'Stop'",
    "if ($env:RESTAURANTAI_PRINT_TEST_FAIL -eq '1') { throw 'mock print failure' }",
    "$event = @{ jobPath = $JobPath; configPath = $ConfigPath; at = (Get-Date).ToString('o') } | ConvertTo-Json -Compress",
    "Add-Content -LiteralPath $env:RESTAURANTAI_PRINT_TEST_RECORD -Value $event",
    "Write-Host 'mock receipt printed'",
    "",
  ].join("\n"),
  "utf8"
);

const { default: app } = await import("../src/app.js");
const { pool } = await import("../src/config/database.js");
const {
  getPrinterConfig,
  getPrinterConfigPath,
} = await import("../src/services/receiptPrinterService.js");
const {
  normalizeReceiptOrderSource,
} = await import("../src/services/kioskReceiptAutoPrintService.js");

const testPrefix = `codex-kiosk-print-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
const createdOrderIds = new Set();
const createdCustomerPhones = new Set();
const createdMenuIds = new Set();
const createdCategoryIds = new Set();

function listen() {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
    server.once("error", reject);
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function writePrinterConfig(overrides = {}) {
  const config = {
    enabled: true,
    printerName: "Mock Thermal Printer",
    paperWidth: "58mm",
    copies: 1,
    autoPrintKioskOrders: true,
    ...overrides,
  };
  await fs.mkdir(configDir, { recursive: true });
  await fs.writeFile(path.join(configDir, "printer.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

async function removePrinterConfig() {
  await fs.rm(path.join(configDir, "printer.json"), { force: true });
}

async function readPrintEvents() {
  try {
    const content = await fs.readFile(printRecordPath, "utf8");
    return content
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function waitFor(predicate, { timeoutMs = 5000, intervalMs = 100 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return null;
}

async function readPrintStore() {
  const storePath = path.join(runtimeDir, "receipt-print-records.json");
  try {
    return JSON.parse(await fs.readFile(storePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { receipts: {} };
    throw error;
  }
}

async function waitForOrderPrintRecord(orderId, result) {
  return waitFor(async () => {
    const store = await readPrintStore();
    const record = store.receipts?.[`kiosk-order:${Number(orderId)}`];
    return record?.result === result ? record : null;
  });
}

async function insertOrderFixtures(suffix) {
  const category = await pool.query(
    `INSERT INTO categories (name, is_active)
     VALUES ($1, true)
     RETURNING id`,
    [`${testPrefix}-category-${suffix}`]
  );
  const categoryId = category.rows[0].id;
  createdCategoryIds.add(categoryId);

  const menu = await pool.query(
    `INSERT INTO menu (category_id, name, description, price, veg_type, is_available)
     VALUES ($1, $2, 'Kiosk receipt auto-print test item', 50.00, 'veg', true)
     RETURNING id`,
    [categoryId, `${testPrefix}-item-${suffix}`]
  );
  const menuId = menu.rows[0].id;
  createdMenuIds.add(menuId);

  const phone = `+9199${String(Date.now()).slice(-8)}${String(suffix).slice(-2).padStart(2, "0")}`;
  const customer = await pool.query(
    `INSERT INTO customers (name, phone, country, is_active)
     VALUES ($1, $2, 'India', true)
     RETURNING id`,
    [`${testPrefix}-customer-${suffix}`, phone]
  );
  createdCustomerPhones.add(phone);

  return { customerId: customer.rows[0].id, menuId };
}

async function postCashOrder(server, {
  source = "kiosk",
  idempotencyKey,
  forwardedFor,
  suffix,
} = {}) {
  const { customerId, menuId } = await insertOrderFixtures(suffix || crypto.randomBytes(2).toString("hex"));
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/payments/cash-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
      "X-Forwarded-For": forwardedFor || `127.0.0.${Math.floor(Math.random() * 200) + 1}`,
    },
    body: JSON.stringify({
      customer_id: customerId,
      payment_method: "pay_at_counter",
      order_type: "dine_in",
      order_source: source,
      idempotency_key: idempotencyKey,
      special_instructions: `Source: ${source}`,
      items: [{ menu_id: menuId, quantity: 1 }],
    }),
  });
  const json = await response.json();
  const order = json.data?.order || json.data;
  if (order?.id) createdOrderIds.add(Number(order.id));
  return { status: response.status, json, order };
}

async function cleanupDatabase() {
  const orderIds = [...createdOrderIds];

  async function tryQuery(sql, params = []) {
    try {
      await pool.query(sql, params);
    } catch (error) {
      if (error.code !== "42P01" && error.code !== "42703") throw error;
    }
  }

  if (orderIds.length) {
    await tryQuery("DELETE FROM payments WHERE order_id = ANY($1::int[])", [orderIds]);
    await tryQuery("DELETE FROM bills WHERE order_id = ANY($1::int[])", [orderIds]);
    await tryQuery("DELETE FROM order_status_history WHERE order_id = ANY($1::int[])", [orderIds]);
    await tryQuery("DELETE FROM customer_notifications WHERE order_id = ANY($1::int[])", [orderIds]);
    await tryQuery("DELETE FROM inventory_stock_movements WHERE source_type = 'order' AND source_id = ANY($1::int[])", [orderIds]);
    await tryQuery("DELETE FROM order_items WHERE order_id = ANY($1::int[])", [orderIds]);
    await tryQuery("DELETE FROM orders WHERE id = ANY($1::int[])", [orderIds]);
  }

  const menuIds = [...createdMenuIds];
  if (menuIds.length) await tryQuery("DELETE FROM menu WHERE id = ANY($1::int[])", [menuIds]);

  const categoryIds = [...createdCategoryIds];
  if (categoryIds.length) await tryQuery("DELETE FROM categories WHERE id = ANY($1::int[])", [categoryIds]);

  const phones = [...createdCustomerPhones];
  if (phones.length) await tryQuery("DELETE FROM customers WHERE phone = ANY($1::text[])", [phones]);
}

test("kiosk cash-order endpoint auto-prints exactly once and respects printer settings", async (t) => {
  const server = await listen();
  t.after(async () => {
    await close(server);
    await cleanupDatabase();
    await pool.end();
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  assert.equal(getPrinterConfigPath(), path.join(tempRoot, "config", "printer.json"));
  assert.equal(normalizeReceiptOrderSource("customer-kiosk"), "kiosk");
  assert.equal(normalizeReceiptOrderSource("KIOSK"), "kiosk");

  await writePrinterConfig({ enabled: true, autoPrintKioskOrders: true });
  const enabledOrder = await postCashOrder(server, {
    idempotencyKey: `${testPrefix}-enabled`,
    forwardedFor: "127.10.0.1",
    suffix: "enabled",
  });
  assert.equal(enabledOrder.status, 201);
  assert.equal(enabledOrder.order.order_source, "kiosk");
  const printedRecord = await waitForOrderPrintRecord(enabledOrder.order.id, "printed");
  assert.ok(printedRecord, "expected kiosk order to be marked printed");
  assert.equal((await readPrintEvents()).length, 1);

  const duplicateOrder = await postCashOrder(server, {
    idempotencyKey: `${testPrefix}-enabled`,
    forwardedFor: "127.10.0.2",
    suffix: "duplicate",
  });
  assert.equal(duplicateOrder.status, 200);
  await new Promise((resolve) => setTimeout(resolve, 400));
  assert.equal((await readPrintEvents()).length, 1, "duplicate request must not spool a second receipt");

  await writePrinterConfig({ enabled: false, autoPrintKioskOrders: true });
  const disabledOrder = await postCashOrder(server, {
    idempotencyKey: `${testPrefix}-disabled`,
    forwardedFor: "127.10.0.3",
    suffix: "disabled",
  });
  assert.equal(disabledOrder.status, 201);
  await new Promise((resolve) => setTimeout(resolve, 400));
  assert.equal((await readPrintEvents()).length, 1, "disabled printer must not spool a receipt");

  await writePrinterConfig({ enabled: true, autoPrintKioskOrders: false });
  const autoDisabledOrder = await postCashOrder(server, {
    idempotencyKey: `${testPrefix}-auto-disabled`,
    forwardedFor: "127.10.0.4",
    suffix: "auto-disabled",
  });
  assert.equal(autoDisabledOrder.status, 201);
  await new Promise((resolve) => setTimeout(resolve, 400));
  assert.equal((await readPrintEvents()).length, 1, "autoPrintKioskOrders=false must not spool a receipt");

  await writePrinterConfig({ enabled: true, autoPrintKioskOrders: true });
  const nonKioskOrder = await postCashOrder(server, {
    source: "customer_web",
    idempotencyKey: `${testPrefix}-non-kiosk`,
    forwardedFor: "127.10.0.5",
    suffix: "non-kiosk",
  });
  assert.equal(nonKioskOrder.status, 401, "customer_web orders still require OTP and must not use kiosk bypass");
  await new Promise((resolve) => setTimeout(resolve, 400));
  assert.equal((await readPrintEvents()).length, 1, "non-kiosk order must not spool a kiosk receipt");

  process.env.RESTAURANTAI_PRINT_TEST_FAIL = "1";
  const failedPrintOrder = await postCashOrder(server, {
    idempotencyKey: `${testPrefix}-print-failure`,
    forwardedFor: "127.10.0.6",
    suffix: "print-failure",
  });
  assert.equal(failedPrintOrder.status, 201, "print failure must not fail order creation");
  const failedRecord = await waitForOrderPrintRecord(failedPrintOrder.order.id, "failed");
  assert.ok(failedRecord, "expected failed print attempt to be recorded");
  delete process.env.RESTAURANTAI_PRINT_TEST_FAIL;

  await removePrinterConfig();
  const missingConfig = await getPrinterConfig();
  assert.equal(missingConfig.configPath, path.join(tempRoot, "config", "printer.json"));
  assert.equal(missingConfig.config.enabled, false);
});
