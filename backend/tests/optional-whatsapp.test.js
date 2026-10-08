import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { spawnSync } from "node:child_process";
import { isWhatsAppEnabled, validateWhatsAppConfiguration } from "../src/config/messagingConfig.js";

let record;
let queries = 0;
const pool = { query: async (sql, values) => {
  queries++;
  if (sql.includes('SELECT COUNT')) return { rows: [{ count: 0 }] };
  if (sql.includes('INSERT INTO phone_verifications')) {
    record = { id: 1, phone_number: values[0], otp_hash: values[1], expires_at: new Date(Date.now() + 300000), failed_attempts: 0 };
    return { rows: [record], rowCount: 1 };
  }
  if (sql.includes('DELETE FROM phone_verifications')) { record = null; return { rows: [] }; }
  if (sql.includes('SELECT id, phone_number')) return { rows: record ? [record] : [], rowCount: record ? 1 : 0 };
  if (sql.includes('SET failed_attempts')) { record.failed_attempts++; return { rows: [] }; }
  if (sql.includes('SET verified_at')) { record.verified_at = new Date(); record.verification_token_hash = values[0]; return { rows: [] }; }
  throw new Error('Unexpected database operation in fixture');
} };
mock.module('../src/config/database.js', { namedExports: { pool } });
const { sendCustomerOtp, verifyCustomerOtp } = await import('../src/controllers/customersController.js');
const { sendWhatsAppMessage } = await import('../src/services/whatsappService.js');
const { sendOrderStatusNotification, retryWhatsAppNotification } = await import('../src/services/notificationService.js');

test('independent SMS OTP and optional WhatsApp', async t => {
  const keys = ['NODE_ENV','WHATSAPP_ENABLED','WHATSAPP_PROVIDER','OTP_DELIVERY_CHANNEL','SMS_PROVIDER','TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_SMS_NUMBER','TWILIO_MESSAGING_SERVICE_SID','OTP_SECRET'];
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  let calls = [], providerRejects = false;
  t.mock.method(console, 'error', () => {});
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.ok(url.startsWith('https://api.twilio.com/'));
    calls.push({ url, form: options.body });
    return { ok: !providerRejects, status: providerRejects ? 400 : 201,
      json: async () => providerRejects ? { message: 'Invalid recipient', code: 21211 } : { sid: 'fixture-sms', status: 'queued' } };
  });
  const reset = () => {
    for (const key of keys) delete process.env[key];
    Object.assign(process.env, { NODE_ENV: 'production', WHATSAPP_ENABLED: 'false', SMS_PROVIDER: 'twilio',
      TWILIO_ACCOUNT_SID: 'fixture-account', TWILIO_AUTH_TOKEN: 'fixture-auth', TWILIO_SMS_NUMBER: '+15551234567', OTP_SECRET: 'fixture-otp-secret' });
    calls = []; queries = 0; record = null; providerRejects = false;
  };
  const invoke = (controller, body) => new Promise((resolve, reject) => {
    const response = { statusCode: 200, status(value) { this.statusCode = value; return this; }, set() { return this; },
      json(value) { resolve({ status: this.statusCode, body: value }); } };
    controller({ body, headers: {} }, response, reject);
  });
  try {
    for (const provider of [undefined, 'invalid-provider']) {
      await t.test(`SMS send and verify with WhatsApp disabled and provider ${provider}`, async () => {
        reset();
        if (provider) process.env.WHATSAPP_PROVIDER = provider;
        assert.doesNotThrow(validateWhatsAppConfiguration);
        const sent = await invoke(sendCustomerOtp, { phone: '6283847237' });
        assert.equal(sent.status, 200);
        assert.equal(calls.length, 1);
        assert.equal(calls[0].form.get('To'), '+916283847237');
        assert.equal(calls[0].form.get('From'), '+15551234567');
        const code = calls[0].form.get('Body').match(/OTP is (\d{6})/)[1];
        assert.notEqual(record.otp_hash, code);
        assert.ok(!Object.hasOwn(sent.body.data, 'otp'));
        const wrong = code === '000000' ? '000001' : '000000';
        assert.equal((await invoke(verifyCustomerOtp, { phone: '6283847237', otp: wrong })).status, 400);
        assert.equal(record.failed_attempts, 1);
        const verified = await invoke(verifyCustomerOtp, { phone: '6283847237', otp: code });
        assert.equal(verified.status, 200);
        assert.ok(verified.body.data.verification_token);
        assert.notEqual(record.verification_token_hash, verified.body.data.verification_token);
      });
    }
    await t.test('disabled notifications do not validate providers, contact APIs, or access database', async () => {
      reset(); process.env.WHATSAPP_PROVIDER = 'invalid-provider';
      assert.equal((await sendWhatsAppMessage({ to: '+916283847237', body: 'fixture' })).deliveryStatus, 'disabled');
      assert.equal(await sendOrderStatusNotification({ id: 1, customer_phone: '+916283847237', tracking_token: 'fixture' }), null);
      assert.equal(await retryWhatsAppNotification(1), null);
      assert.equal(calls.length, 0); assert.equal(queries, 0);
    });
    await t.test('enabled WhatsApp requires a valid provider and existing configurations remain enabled', async () => {
      reset(); process.env.WHATSAPP_ENABLED = 'true';
      for (const provider of ['', 'invalid-provider', 'mock']) {
        process.env.WHATSAPP_PROVIDER = provider;
        assert.throws(validateWhatsAppConfiguration, /Enabled WhatsApp requires/);
      }
      for (const provider of ['meta','twilio']) {
        process.env.WHATSAPP_PROVIDER = provider;
        assert.doesNotThrow(validateWhatsAppConfiguration);
        delete process.env.WHATSAPP_ENABLED;
        assert.equal(isWhatsAppEnabled(), true);
      }
    });
    await t.test('SMS accepts a Messaging Service instead of a sender number', async () => {
      reset(); delete process.env.TWILIO_SMS_NUMBER; process.env.TWILIO_MESSAGING_SERVICE_SID = 'fixture-service';
      assert.equal((await invoke(sendCustomerOtp, { phone: '6283847237' })).status, 200);
      assert.equal(calls[0].form.get('MessagingServiceSid'), 'fixture-service');
      assert.equal(calls[0].form.has('From'), false);
    });
    await t.test('missing SMS configuration cannot claim success and removes unsent verification', async () => {
      reset(); delete process.env.SMS_PROVIDER;
      const result = await invoke(sendCustomerOtp, { phone: '6283847237' });
      assert.equal(result.status, 503);
      assert.equal(result.body.message, 'Unable to send OTP right now. Please try again.');
      assert.equal(calls.length, 0); assert.equal(record, null);
    });
    await t.test('SMS delivery rejection keeps fail-closed cleanup behavior', async () => {
      reset(); providerRejects = true;
      assert.equal((await invoke(sendCustomerOtp, { phone: '6283847237' })).status, 500);
      assert.equal(record, null);
    });
    await t.test('production startup config ignores disabled invalid provider, rejects enabled invalid provider', () => {
      reset();
      for (const flag of ['false','true']) {
        const child = spawnSync(process.execPath, ['--input-type=module', '-e', 'await import("./backend/src/config/index.js")'], {
          cwd: new URL('../../', import.meta.url), encoding: 'utf8', env: { ...process.env,
            RESTAURANTAI_ENV_FILE: 'nonexistent-test-env', WHATSAPP_ENABLED: flag, WHATSAPP_PROVIDER: 'invalid-provider', JWT_SECRET: 'fixture-jwt-secret' },
        });
        assert.equal(child.status, flag === 'false' ? 0 : 1);
        if (flag === 'true') assert.match(child.stderr, /Enabled WhatsApp requires/);
      }
    });
  } finally {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key];
    }
  }
});
