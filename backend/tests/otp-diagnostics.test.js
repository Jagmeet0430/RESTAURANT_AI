import assert from "node:assert/strict";
import { mock, test } from "node:test";

const pool = { query: async () => { throw new Error("Unexpected database access"); } };
mock.module("../src/config/database.js", { namedExports: { pool } });
const { sendCustomerOtp } = await import("../src/controllers/customersController.js");
const { logOtpSendFailure } = await import("../src/services/otpDiagnostics.js");

test("OTP send diagnostics using isolated database/provider fixtures", async t => {
  const keys = ["NODE_ENV", "WHATSAPP_ENABLED", "OTP_DELIVERY_CHANNEL", "SMS_PROVIDER", "WHATSAPP_PROVIDER", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_NUMBER", "OTP_SECRET", "JWT_SECRET", "DB_PASSWORD", "SMS_API_KEY"];
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const logs = [];
  const consoleMock = t.mock.method(console, "error", line => logs.push(JSON.parse(line)));
  const phone = "+916283847237";
  const capturedBodies = [];
  let failureStage;
  let databaseError;
  let providerFailure;
  let cleanupFailure;
  let limited;

  function reset() {
    logs.length = 0;
    capturedBodies.length = 0;
    failureStage = undefined;
    databaseError = undefined;
    providerFailure = false;
    cleanupFailure = false;
    limited = false;
    for (const key of keys) delete process.env[key];
    Object.assign(process.env, {
      NODE_ENV: "production", OTP_SECRET: "fixture-otp-secret", JWT_SECRET: "fixture-jwt-secret",
      DB_PASSWORD: "fixture-db-password", SMS_API_KEY: "fixture-sms-secret",
    });
  }
  function invoke() {
    return new Promise((resolve, reject) => {
      const response = { statusCode: 200, headers: {},
        status(value) { this.statusCode = value; return this; },
        set(key, value) { this.headers[key] = value; return this; },
        json(body) { resolve({ status: this.statusCode, body, headers: this.headers }); },
      };
      sendCustomerOtp({ body: { phone }, headers: {} }, response, reject);
    });
  }
  function assertPrivate() {
    const serialized = JSON.stringify(logs);
    for (const secret of [phone, phone.slice(1), phone.slice(3), "fixture-otp-secret", "fixture-jwt-secret", "fixture-db-password", "fixture-sms-secret", "fixture-access-secret", "fixture-twilio-secret", "fixture-stack-private"]) {
      assert.ok(!serialized.includes(secret), `secret leaked: ${secret}`);
    }
    for (const body of capturedBodies) {
      const otp = body.match(/OTP is (\d{6})/)?.[1];
      if (otp) assert.ok(!serialized.includes(otp), "OTP leaked");
    }
    for (const event of logs) {
      assert.equal(event.phone, "********7237");
      assert.equal(event.stack, undefined);
      for (const entry of event.environment) assert.equal(typeof entry.present, "boolean");
    }
  }

  pool.query = async sql => {
    const operation = sql.trim().split(/\s+/)[0];
    if (operation === failureStage) throw databaseError;
    if (operation === "DELETE" && cleanupFailure) throw Object.assign(new Error('permission denied for table phone_verifications'), { code: '42501' });
    if (operation === "SELECT") return { rows: [{ count: 0, last_request_at: limited ? new Date() : null }] };
    return { rows: [{ id: 1, phone_number: phone, expires_at: new Date() }] };
  };
  t.mock.method(globalThis, "fetch", async (url, options) => {
    const body = url.includes('twilio') ? options.body.get('Body') : JSON.parse(options.body).text.body;
    capturedBodies.push(body);
    if (url.includes('twilio')) assert.equal(options.body.get('To'), `whatsapp:${phone}`);
    else assert.equal(JSON.parse(options.body).to, phone.slice(1));
    return { ok: !providerFailure, status: providerFailure ? 400 : 200, json: async () => providerFailure
      ? { code: 21211, message: `Invalid To ${phone}; ${body}; fixture-twilio-secret`, error: { code: 131030, message: `Recipient ${phone} rejected; ${body}; fixture-access-secret` } }
      : { sid: 'fixture-message', messages: [{ id: 'fixture-message' }], status: 'sent' } };
  });

  try {
    await t.test("missing delivery provider is logged and returns generic 503", async () => {
      reset();
      const result = await invoke();
      assert.equal(result.status, 503);
      assert.equal(result.body.message, "Unable to send OTP right now. Please try again.");
      assert.ok(logs.some(event => event.stage === "provider_send" && event.errorMessage.includes("SMS_PROVIDER=twilio")));
      assert.ok(logs.some(event => event.stage === "controller"));
      assert.equal(logs[0].environment.find(e => e.variable === "WHATSAPP_PROVIDER").present, false);
      assertPrivate();
    });
    for (const provider of ['meta', 'twilio']) {
      await t.test(`${provider} missing credentials are diagnosed`, async () => {
        reset(); process.env.WHATSAPP_PROVIDER = provider;
        assert.equal((await invoke()).status, 500);
        assert.match(logs[0].errorMessage, /credentials are not configured/);
        assert.equal(logs[0].provider, provider);
        assertPrivate();
      });
      await t.test(`${provider} recipient rejection preserves code, masks OTP/phone, and logs cleanup failure`, async () => {
        reset();
        Object.assign(process.env, { WHATSAPP_PROVIDER: provider, WHATSAPP_ACCESS_TOKEN: 'fixture-access-secret', WHATSAPP_PHONE_NUMBER_ID: 'fixture-id', TWILIO_ACCOUNT_SID: 'fixture-account', TWILIO_AUTH_TOKEN: 'fixture-twilio-secret', TWILIO_WHATSAPP_NUMBER: 'whatsapp:+15551234567' });
        providerFailure = true;
        cleanupFailure = true;
        assert.equal((await invoke()).status, 500);
        assert.ok(logs.some(e => e.stage === 'provider_send' && e.code === (provider === 'meta' ? '131030' : '21211') && e.providerStatus === 400));
        assert.ok(logs.some(e => e.stage === 'phone_verifications_cleanup' && e.code === '42501'));
        assertPrivate();
      });
    }
    for (const [operation, stage, code, message] of [
      ['SELECT', 'phone_verifications_select', '42P01', 'relation "phone_verifications" does not exist'],
      ['INSERT', 'phone_verifications_insert', '42703', 'column "otp_hash" does not exist'],
    ]) {
      await t.test(`${operation} database failures are identified`, async () => {
        reset(); failureStage = operation;
        databaseError = Object.assign(new Error(message), { code, detail: phone, stack: 'fixture-stack-private' });
        assert.equal((await invoke()).status, 500);
        assert.ok(logs.some(e => e.stage === stage && e.code === code));
        assertPrivate();
      });
    }
    await t.test('cooldown rule and Retry-After remain unchanged', async () => {
      reset(); limited = true;
      const result = await invoke();
      assert.equal(result.status, 429);
      assert.ok(result.headers['Retry-After']);
      assertPrivate();
    });
    for (const provider of ['meta', 'twilio']) {
      await t.test(`enabled ${provider} successful send remains unchanged`, async () => {
        reset();
        Object.assign(process.env, { WHATSAPP_ENABLED: 'true', WHATSAPP_PROVIDER: provider, WHATSAPP_ACCESS_TOKEN: 'fixture-access-secret', WHATSAPP_PHONE_NUMBER_ID: 'fixture-id', TWILIO_ACCOUNT_SID: 'fixture-account', TWILIO_AUTH_TOKEN: 'fixture-twilio-secret', TWILIO_WHATSAPP_NUMBER: 'whatsapp:+15551234567' });
        const result = await invoke();
        assert.equal(result.status, 200);
        assert.equal(result.body.data.phone, phone);
        assert.equal(logs.length, 0);
      });
    }
    await t.test('sanitizer strips values embedded in error text', () => {
      reset();
      logOtpSendFailure(Object.assign(new Error(`OTP 123456 to +91 62838 47237; fixture-db-password; Bearer abcdef; postgres://user:pass@host/db; fixture-sms-secret`), { code: 'ECONNRESET' }), { phone, sensitiveValues: ['123456'] });
      assert.equal(logs[0].code, 'ECONNRESET');
      assert.ok(!JSON.stringify(logs).includes('123456'));
      assert.ok(!JSON.stringify(logs).includes('62838 47237'));
      assertPrivate();
    });
  } finally {
    consoleMock.mock.restore();
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
});
