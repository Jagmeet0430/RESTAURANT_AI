import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { publicOrderOtpRequired } from "../src/config/publicOrderConfig.js";

let fixture;
const result = (rows = []) => ({ rows, rowCount: rows.length });
const client = {
  release() {},
  async query(sql, values = []) {
    const query = sql.replace(/\s+/g, " ").trim();
    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(query)) return result();
    if (query.startsWith("CREATE TABLE IF NOT EXISTS app_settings")) return result();
    if (query.startsWith("SELECT value FROM app_settings")) return result([{ value: { public_order_otp_required: false } }]);
    if (query.includes("FROM customers WHERE id")) return result([fixture.customer]);
    if (query.includes("FROM menu WHERE id")) return result([fixture.menu]);
    if (query.includes("WHERE idempotency_key")) return result(fixture.orders.filter(order => order.idempotency_key === values[0]));
    if (query.startsWith("SELECT COUNT(*)::int AS count")) {
      fixture.limitChecks++;
      return result([{ count: fixture.dailyCount }]);
    }
    if (/^SELECT COUNT\(\*\) AS count/i.test(query)) return result([{ count: fixture.orders.length }]);
    if (query.startsWith("INSERT INTO orders (")) {
      const [, columns, expressions] = query.match(/INSERT INTO orders \((.*?)\) VALUES \((.*?)\) RETURNING/);
      const order = { id: fixture.orders.length + 1 };
      const fields = columns.split(",").map(field => field.trim());
      expressions.split(",").forEach((expression, index) => {
        const value = expression.trim();
        order[fields[index]] = value.startsWith("$") ? values[Number(value.slice(1)) - 1] : value.replaceAll("'", "");
      });
      fixture.orders.push(order);
      return result([order]);
    }
    if (/^INSERT INTO (order_items|order_status_history|payments) /.test(query)) return result();
    throw new Error(`Unexpected fixture query: ${query}`);
  },
};
mock.module("../src/config/database.js", { namedExports: { pool: { query: client.query, connect: async () => client } } });
mock.module("../src/services/orderSchemaService.js", { namedExports: { ensureOrderSecuritySchema: async () => {} } });
mock.module("../src/services/otpService.js", { namedExports: {
  createPhoneOtp: async () => {}, verifyPhoneOtp: async () => {},
  requireVerifiedPhoneToken: async (phone, token) => {
    fixture.tokenChecks++;
    assert.equal(phone, "+919876543210");
    if (token !== "valid-fixture-token") throw Object.assign(new Error("Invalid verification token"), { statusCode: 401 });
  },
} });
mock.module("../src/services/orderLifecycleService.js", { namedExports: {
  ORDER_VISIBILITY_MINUTES: 30, cancelExpiredPendingOrders: async () => {}, terminalVisibilitySql: () => "",
  ensureNotificationTable: async () => {}, createCustomerNotification: async () => ({}),
} });
mock.module("../src/services/billingService.js", { namedExports: {
  createBillForOrder: async () => ({}), normalizeStaffPaymentMethod: () => ({}), payOrder: async () => ({}),
} });
mock.module("../src/services/inventoryStockService.js", { namedExports: { deductInventoryForOrder: async () => [] } });
mock.module("../src/services/kioskReceiptAutoPrintService.js", { namedExports: { requestKioskReceiptAutoPrint: () => {} } });
mock.module("../src/services/notificationService.js", { namedExports: { sendOrderStatusNotification: async () => {} } });
const tableQr = await import("../src/services/tableQrService.js");
mock.module("../src/services/tableQrService.js", { namedExports: {
  ...tableQr,
  ensureTableQrSchema: async () => {},
  generateDailyTokenNumber: async () => ({ token_number: 101, token_date: "2026-10-08" }),
  resolveTableForOrder: async (_client, token) => token ? { id: 7, table_number: "7" } : null,
} });
const { createCashOrder } = await import("../src/controllers/paymentController.js");
const { createOrder } = await import("../src/controllers/ordersController.js");
const { getPublicSettings } = await import("../src/controllers/settingsController.js");
const { getVerifiedCustomerOrders } = await import("../src/controllers/customersController.js");

function invoke(controller, body = {}) {
  return new Promise((resolve, reject) => {
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, set() { return this; },
      json(payload) { resolve({ status: this.statusCode, ...payload }); } };
    Promise.resolve(controller({ body, headers: {}, get: () => undefined }, res, reject)).catch(reject);
  });
}

test("public checkout OTP feature flag", async t => {
  const keys = ["NODE_ENV", "RESTAURANTAI_MODE", "PUBLIC_ORDER_OTP_REQUIRED"];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  t.mock.method(console, "error", () => {});
  t.mock.method(console, "log", () => {});
  const reset = (flag = "false", mode = "online") => {
    Object.assign(process.env, { NODE_ENV: "production", RESTAURANTAI_MODE: mode });
    if (flag === undefined) delete process.env.PUBLIC_ORDER_OTP_REQUIRED;
    else process.env.PUBLIC_ORDER_OTP_REQUIRED = flag;
    fixture = { customer: { id: 1, name: "Fixture", phone: "9876543210" },
      menu: { id: 1, name: "Fixture item", price: 100, is_available: true },
      orders: [], dailyCount: 0, limitChecks: 0, tokenChecks: 0 };
  };
  const body = (extra = {}) => ({ customer_id: 1, order_source: "customer_web", order_type: "pickup",
    payment_method: "pay_at_counter", idempotency_key: "fixture-key", items: [{ menu_id: 1, quantity: 2, price: 1 }], ...extra });
  try {
    await t.test("only explicit false disables; local mode stays required", () => {
      for (const value of [undefined, "", "true", "0", "invalid"]) {
        reset();
        if (value === undefined) delete process.env.PUBLIC_ORDER_OTP_REQUIRED;
        else process.env.PUBLIC_ORDER_OTP_REQUIRED = value;
        assert.equal(publicOrderOtpRequired(), true);
      }
      reset(" FALSE "); assert.equal(publicOrderOtpRequired(), false);
      reset("false", "local"); assert.equal(publicOrderOtpRequired(), true);
    });
    await t.test("public settings exposes an environment boolean, never a DB override", async () => {
      for (const [flag, mode, expected] of [["false", "online", false], ["true", "online", true], ["false", "local", true]]) {
        reset(flag, mode);
        const response = await invoke(getPublicSettings);
        assert.equal(response.data.public_order_otp_required, expected);
        assert.equal(Object.hasOwn(response.data, "password"), false);
      }
    });
    for (const [name, controller] of [["orders", createOrder], ["cash checkout", createCashOrder]]) {
      await t.test(`${name}: disabled accepts unverified order, calculates prices and deduplicates`, async () => {
        reset();
        assert.equal((await invoke(controller, body())).status, 201);
        assert.equal(fixture.orders.length, 1);
        assert.equal(fixture.orders[0].phone_verified, false);
        assert.equal(fixture.orders[0].customer_phone, "+919876543210");
        assert.equal(fixture.orders[0].total_amount, 220);
        assert.equal(fixture.orders[0].subtotal, 200);
        assert.equal(fixture.tokenChecks, 0);
        assert.equal(fixture.limitChecks, 1);
        assert.equal((await invoke(controller, body())).status, 200);
        assert.equal(fixture.orders.length, 1);
      });
      await t.test(`${name}: required rejects missing token and accepts valid token`, async () => {
        reset("true");
        assert.equal((await invoke(controller, body())).status, 401);
        assert.equal(fixture.orders.length, 0);
        assert.equal((await invoke(controller, body({ otp_verification_token: "valid-fixture-token" }))).status, 201);
        assert.equal(fixture.orders[0].phone_verified, true);
        assert.equal(fixture.tokenChecks, 1);
      });
      await t.test(`${name}: local mode cannot bypass OTP`, async () => {
        reset("false", "local");
        assert.equal((await invoke(controller, body())).status, 401);
      });
      await t.test(`${name}: supplied invalid token still rejected when disabled`, async () => {
        reset();
        assert.equal((await invoke(controller, body({ otp_verification_token: "invalid" }))).status, 401);
        assert.equal(fixture.orders.length, 0);
      });
      await t.test(`${name}: phone, availability, quantity, delivery and daily limit remain enforced`, async () => {
        for (const phone of ["", "123", "1111111111"]) {
          reset(); fixture.customer.phone = phone;
          assert.equal((await invoke(controller, body())).status, 400);
        }
        reset(); fixture.menu.is_available = false;
        assert.equal((await invoke(controller, body())).status, 409);
        reset();
        assert.equal((await invoke(controller, body({ items: [{ menu_id: 1, quantity: 0 }] }))).status, 400);
        assert.equal((await invoke(controller, body({ order_type: "delivery" }))).status, 400);
        fixture.dailyCount = 100000;
        const limited = await invoke(controller, body());
        assert.equal(limited.status, 429);
        assert.equal(limited.code, "DAILY_ORDER_LIMIT_REACHED");
        assert.equal(fixture.orders.length, 0);
      });
      await t.test(`${name}: kiosk and table QR do not acquire an OTP requirement`, async () => {
        for (const flag of ["true", "false"]) {
          for (const source of ["kiosk", "table_qr"]) {
            reset(flag);
            assert.equal((await invoke(controller, body({ order_source: source, table_token: source === "table_qr" ? "fixture" : null }))).status, 201);
            assert.equal(fixture.tokenChecks, 0);
            assert.equal(fixture.limitChecks, 0);
            if (source === "table_qr") assert.equal(fixture.orders[0].order_type, "dine_in");
          }
        }
      });
    }
    await t.test("phone-based tracking still requires verification when checkout OTP is disabled", async () => {
      reset();
      assert.equal((await invoke(getVerifiedCustomerOrders, { phone: "9876543210" })).status, 401);
      assert.equal((await invoke(getVerifiedCustomerOrders, { phone: "9876543210", otp_verification_token: "invalid" })).status, 401);
    });
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
