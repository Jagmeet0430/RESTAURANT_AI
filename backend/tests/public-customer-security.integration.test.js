import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import pg from 'pg';
import dotenv from 'dotenv';
import express from 'express';

test('public OTP and tracking security on a disposable PostgreSQL database', async t => {
  const env = dotenv.parse(await fs.readFile(new URL('../.env', import.meta.url)));
  const connection = { host: '127.0.0.1', port: Number(env.DB_PORT || 5432), user: env.DB_USER || 'postgres', password: env.DB_PASSWORD };
  const name = `restaurantai_public_test_${Date.now()}`;
  assert.match(name, /^restaurantai_public_test_\d+$/);
  const admin = new pg.Pool({ ...connection, database: 'postgres' });
  let db, created = false, delivered, rejectDelivery = false;
  try {
    await admin.query(`CREATE DATABASE "${name}"`); created = true;
    db = new pg.Pool({ ...connection, database: name });
    const schema = (await fs.readFile(new URL('../database/bootstrap/offline_v1_schema.sql', import.meta.url), 'utf8'))
      .split(/\r?\n/).filter(line => !line.startsWith('\\')).join('\n');
    await db.query(schema);
    await db.query('SET search_path TO public');
    for (const file of ['014_table_qr_ordering.sql', '015_billing_receipts_settlement.sql', '016_cloud_order_sync.sql']) {
      await db.query(await fs.readFile(new URL(`../database/migrations/${file}`, import.meta.url), 'utf8'));
    }
    await db.query("INSERT INTO categories(name) VALUES ('Fixture')");
    await db.query("INSERT INTO menu(id,category_id,name,price,is_available,veg_type) VALUES (1,1,'Fixture Roll',90,true,'veg')");
    await db.query("INSERT INTO customers(name,phone) VALUES ('Owner','+919876543210'),('Other','+919876543211')");
    await db.query("INSERT INTO orders(customer_id,order_number,status,subtotal,total_amount,customer_phone,tracking_token) VALUES (1,'OWN','Confirmed',90,94.5,'+919876543210',$1),(2,'OTHER','Ready',100,100,'+919876543211',$2)", [crypto.randomBytes(32).toString('hex'),crypto.randomBytes(32).toString('hex')]);
    process.env.OTP_SECRET = crypto.randomBytes(32).toString('hex');
    Object.assign(process.env, { RESTAURANTAI_MODE: 'online', PUBLIC_ORDER_OTP_REQUIRED: 'true', WHATSAPP_ENABLED: 'false' });
    mock.module('../src/config/database.js', { exports: { pool: db } });
    mock.module('../src/services/kioskReceiptAutoPrintService.js', { exports: { requestKioskReceiptAutoPrint: () => {} } });
    mock.module('../src/services/otpDeliveryService.js', { exports: { sendOtpMessage: async ({ body }) => {
      if (rejectDelivery) throw Object.assign(new Error('Fixture provider unavailable'), { code: 'PROVIDER_UNAVAILABLE' });
      delivered = body.match(/\b\d{6}\b/)[0];
      return { providerMessageId: 'fixture-only', deliveryStatus: 'accepted' };
    } } });
    const otp = await import('../src/services/otpService.js');
    const { getVerifiedCustomerOrders } = await import('../src/controllers/customersController.js');
    const { createCashOrder, quotePublicOrder, recoverPublicOrder } = await import('../src/controllers/paymentController.js');
    const invoke = (controller, body) => new Promise((resolve, reject) => {
      const res = { statusCode: 200, set() {}, status(code) { this.statusCode = code; return this; },
        json(payload) { resolve({ status: this.statusCode, ...payload }); } };
      Promise.resolve(controller({ body, headers: {}, get: () => undefined }, res, reject)).catch(reject);
    });
    const phone = '+919876543210';
    const reset = async () => { await db.query('DELETE FROM phone_verifications'); rejectDelivery = false; };
    const issue = async (purpose = 'checkout') => {
      const result = await otp.createPhoneOtp(phone, { purpose });
      assert.ok(!JSON.stringify(result).includes(delivered));
      return delivered;
    };
    const lookup = (phone, token) => new Promise((resolve, reject) => {
      const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { resolve({ status: this.statusCode, ...body }); } };
      getVerifiedCustomerOrders({ body: { phone, otp_verification_token: token } }, res, reject);
    });
    await t.test('correct challenge succeeds once; wrong code on a verified record cannot mint another token', async () => {
      await reset(); const code = await issue();
      const verified = await otp.verifyPhoneOtp({ phone, otp: code });
      await assert.rejects(otp.verifyPhoneOtp({ phone, otp: code === '111111' ? '222222' : '111111' }), { statusCode: 400 });
      await assert.rejects(otp.verifyPhoneOtp({ phone, otp: code }), { statusCode: 400 });
      await otp.requireVerifiedPhoneToken(phone, verified.verification_token);
      await assert.rejects(otp.requireVerifiedPhoneToken(phone, verified.verification_token), { statusCode: 401 });
    });
    await t.test('wrong phone and purpose rejected; tracking cannot authorize checkout', async () => {
      await reset(); const code = await issue('tracking');
      await assert.rejects(otp.verifyPhoneOtp({ phone, otp: code, purpose: 'checkout' }), { statusCode: 400 });
      const verified = await otp.verifyPhoneOtp({ phone, otp: code, purpose: 'tracking' });
      await assert.rejects(otp.requireVerifiedPhoneToken('+919876543211', verified.verification_token, { purpose: 'tracking', consume: false }), { statusCode: 401 });
      await assert.rejects(otp.requireVerifiedPhoneToken(phone, verified.verification_token), { statusCode: 401 });
      assert.equal((await lookup('+919876543211', verified.verification_token)).status, 401);
      const own = await lookup('9876543210', verified.verification_token);
      assert.equal(own.status, 200);
      assert.deepEqual(own.data.orders.map(order => order.order_number), ['OWN']);
      await db.query("UPDATE orders SET status='Preparing' WHERE order_number='OWN'");
      assert.equal((await lookup(phone, verified.verification_token)).data.orders[0].status, 'Preparing');
      const altered = verified.verification_token.split('.');
      const payload = JSON.parse(Buffer.from(altered[0], 'base64url')); payload.exp = 1;
      altered[0] = Buffer.from(JSON.stringify(payload)).toString('base64url');
      altered[1] = crypto.createHmac('sha256', process.env.OTP_SECRET).update(altered[0]).digest('base64url');
      assert.equal((await lookup(phone, altered.join('.'))).status, 401);
    });
    await t.test('expired challenges, attempt limits and resend cooldown stay enforced', async () => {
      await reset(); const code = await issue();
      await assert.rejects(otp.createPhoneOtp(phone), { statusCode: 429 });
      await db.query("UPDATE phone_verifications SET expires_at=NOW()-INTERVAL '1 second'");
      await assert.rejects(otp.verifyPhoneOtp({ phone, otp: code }), { statusCode: 400 });
      await reset(); const fresh = await issue();
      for (let n = 0; n < 5; n++) await assert.rejects(otp.verifyPhoneOtp({ phone, otp: fresh === '111111' ? '222222' : '111111' }), { statusCode: 400 });
      await assert.rejects(otp.verifyPhoneOtp({ phone, otp: fresh }), { statusCode: 429 });
      await assert.rejects(otp.createPhoneOtp(phone), { statusCode: 429 });
    });
    await t.test('simultaneous correct verification has exactly one winner', async () => {
      await reset(); const code = await issue();
      const results = await Promise.allSettled([otp.verifyPhoneOtp({ phone, otp: code }), otp.verifyPhoneOtp({ phone, otp: code })]);
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    });
    await t.test('failed provider delivery cannot leave a usable challenge', async () => {
      await reset(); rejectDelivery = true;
      await assert.rejects(otp.createPhoneOtp(phone), { code: 'PROVIDER_UNAVAILABLE' });
      assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM phone_verifications')).rows[0].n, 0);
    });
    await t.test('a fresh challenge replaces an old verified challenge without bypass', async () => {
      await reset(); const code = await issue();
      await otp.verifyPhoneOtp({ phone, otp: code });
      await db.query("UPDATE phone_verifications SET created_at=NOW()-INTERVAL '31 seconds'");
      const fresh = await issue();
      await assert.rejects(otp.verifyPhoneOtp({ phone, otp: fresh === '111111' ? '222222' : '111111' }), { statusCode: 400 });
      assert.ok((await otp.verifyPhoneOtp({ phone, otp: fresh })).verification_token);
    });
    await t.test('rolling send limit is enforced independently of resend cooldown', async () => {
      await reset();
      for (let n = 0; n < 3; n++) {
        await issue();
        await db.query("UPDATE phone_verifications SET created_at=NOW()-INTERVAL '31 seconds'");
      }
      await assert.rejects(otp.createPhoneOtp(phone), { statusCode: 429 });
    });
    await t.test('real verified checkout: quote, zero packing, concurrent deduplication and owned outcome', async () => {
      await reset();
      const code = await issue();
      const verified = await otp.verifyPhoneOtp({ phone, otp: code });
      const body = { customer_id: 1, items: [{ menu_id: 1, quantity: 1, price: 1 }],
        order_source: 'customer_web', order_type: 'pickup', payment_method: 'pay_at_counter',
        idempotency_key: `web-${crypto.randomUUID()}`, otp_verification_token: verified.verification_token };
      const quote = await invoke(quotePublicOrder, body);
      assert.equal(quote.data.total, 94.5); assert.equal(quote.data.delivery_charge, 0);
      const responses = await Promise.all([invoke(createCashOrder, body), invoke(createCashOrder, body)]);
      assert.deepEqual(responses.map(response => response.status).sort(), [200, 201]);
      const order = responses[0].data.order;
      assert.equal(order.id, responses[1].data.order.id);
      assert.equal(Number(order.total_amount), quote.data.total);
      assert.equal(Number(order.delivery_charge), 0);
      assert.equal(order.phone_verified, true);
      assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM orders WHERE idempotency_key=$1', [body.idempotency_key])).rows[0].n, 1);
      assert.equal((await invoke(createCashOrder, { ...body, idempotency_key: `web-${crypto.randomUUID()}` })).status, 401);
      const recovery = { idempotency_key: body.idempotency_key, phone, otp_verification_token: verified.verification_token };
      assert.equal((await invoke(recoverPublicOrder, recovery)).data.order.id, order.id);
      assert.equal((await invoke(recoverPublicOrder, { ...recovery, phone: '+919876543211' })).status, 401);
      assert.equal((await invoke(recoverPublicOrder, { ...recovery, otp_verification_token: '' })).status, 401);
      assert.equal((await invoke(recoverPublicOrder, { ...recovery, idempotency_key: `web-${crypto.randomUUID()}` })).data.order, null);
    });
    await t.test('notification SQL failure does not roll back an already saved website order', async () => {
      await reset(); const code = await issue();
      const verified = await otp.verifyPhoneOtp({ phone, otp: code });
      await db.query('ALTER TABLE customer_notifications RENAME TO fixture_notifications_unavailable');
      try {
        const response = await invoke(createCashOrder, { customer_id: 1, items: [{ menu_id: 1, quantity: 1 }],
          order_source: 'customer_web', order_type: 'pickup', payment_method: 'pay_at_counter',
          idempotency_key: `web-${crypto.randomUUID()}`, otp_verification_token: verified.verification_token });
        assert.equal(response.status, 201);
        assert.equal((await db.query('SELECT total_amount FROM orders WHERE id=$1', [response.data.order.id])).rows[0].total_amount, '94.50');
        await new Promise(resolve => setTimeout(resolve, 50));
      } finally { await db.query('ALTER TABLE fixture_notifications_unavailable RENAME TO customer_notifications'); }
    });
    await t.test('HTTP routes require ownership and enforce the OTP send rate limit', async () => {
      await reset();
      const { default: customers } = await import('../src/routes/customersRoutes.js');
      const { default: notifications } = await import('../src/routes/notificationsRoutes.js');
      const app = express(); app.use(express.json());
      app.use('/api/customers', customers); app.use('/api/notifications', notifications);
      app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ success: false, message: 'Request failed' }));
      const server = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
      const base = `http://127.0.0.1:${server.address().port}/api`;
      const post = (path, body) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      try {
        assert.equal((await post('/customers/otp/send', { phone, purpose: 'checkout' })).status, 200);
        const verified = await post('/customers/otp/verify', { phone, otp: delivered, purpose: 'checkout' });
        assert.equal(verified.status, 200);
        const token = (await verified.json()).data.verification_token;
        assert.equal((await fetch(base + '/notifications/customer/1')).status, 401);
        assert.equal((await fetch(base + '/notifications/phone/' + encodeURIComponent(phone))).status, 401);
        const headers = { Authorization: `Bearer ${token}` };
        assert.equal((await fetch(base + '/notifications/phone/' + encodeURIComponent(phone), { headers })).status, 200);
        assert.equal((await fetch(base + '/notifications/phone/%2B919876543211', { headers })).status, 401);
        for (let n = 0; n < 4; n++) assert.equal((await post('/customers/otp/send', { phone: 'invalid' })).status, 400);
        const limited = await post('/customers/otp/send', { phone: 'invalid' });
        assert.equal(limited.status, 429); assert.ok(Number(limited.headers.get('retry-after')) > 0);
      } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    });
    await t.test('cloud source spoofing is blocked; a genuinely validated QR keeps its exemption', async () => {
      const body = { customer_id: 2, items: [{ menu_id: 1, quantity: 1 }], order_type: 'pickup', payment_method: 'pay_at_counter' };
      const before = (await db.query('SELECT COUNT(*)::int AS n FROM orders')).rows[0].n;
      for (const source of ['kiosk', 'pos', 'table_qr']) {
        assert.equal((await invoke(createCashOrder, { ...body, order_source: source })).status, source === 'table_qr' ? 400 : 403);
      }
      assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM orders')).rows[0].n, before);
      await db.query("INSERT INTO restaurant_tables(table_number,display_name,qr_token,is_active) VALUES ('9','Fixture Table','TBL-SECURITY-FIXTURE',true)");
      const qr = await invoke(createCashOrder, { ...body, order_source: 'table_qr', table_token: 'TBL-SECURITY-FIXTURE' });
      assert.equal(qr.status, 201);
      assert.equal(qr.data.order.order_type, 'dine_in');
      assert.equal(qr.data.order.phone_verified, false);
      assert.equal(qr.data.order.table_number, '9');
      await db.query("UPDATE restaurant_tables SET is_active=false WHERE table_number='9'");
      assert.equal((await invoke(createCashOrder, { ...body, order_source: 'table_qr', table_token: 'TBL-SECURITY-FIXTURE' })).status, 404);
    });
  } finally {
    if (db) await db.end();
    if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.end();
  }
});
