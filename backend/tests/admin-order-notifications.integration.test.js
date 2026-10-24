import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import pg from 'pg';
import express from 'express';
import jwt from 'jsonwebtoken';

const exec = promisify(execFile);
test('durable Admin arrivals on an isolated PostgreSQL cluster (no installed DB or printer)', { timeout: 180000 }, async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'restaurantai-notifications-'));
  const data = path.join(root, 'data');
  const bin = process.env.RESTAURANTAI_TEST_PG_BIN || 'C:/Program Files/PostgreSQL/18/bin';
  const executable = name => path.join(bin, name + (process.platform === 'win32' ? '.exe' : ''));
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  let db, server, started = false, queueFails = false;
  const savedEnv = { ...process.env };
  try {
    await exec(executable('initdb'), ['-D', data, '-U', 'postgres', '-A', 'trust', '--no-locale', '-E', 'UTF8'], { windowsHide: true, timeout: 30000 });
    await exec(executable('pg_ctl'), ['-D', data, '-l', path.join(root, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port} -F`, '-w', 'start'], { windowsHide: true, timeout: 30000 });
    started = true;
    db = new pg.Pool({ host: '127.0.0.1', port, user: 'postgres', database: 'postgres', connectionTimeoutMillis: 3000 });
    const bootstrap = (await fs.readFile(new URL('../database/bootstrap/offline_v1_schema.sql', import.meta.url), 'utf8'))
      .split(/\r?\n/).filter(line => !line.startsWith('\\')).join('\n');
    await db.query(bootstrap);
    await db.query('SET search_path = public');
    for (const name of ['014_table_qr_ordering.sql', '015_billing_receipts_settlement.sql', '016_cloud_order_sync.sql']) {
      await db.query(await fs.readFile(new URL(`../database/migrations/${name}`, import.meta.url), 'utf8'));
    }
    await db.query("INSERT INTO customers(name,phone) VALUES ('Fixture','+919876543210')");
    await db.query("INSERT INTO categories(name) VALUES ('Fixture')");
    await db.query("INSERT INTO menu(category_id,name,price,veg_type,barcode) VALUES (1,'Fixture Roll',100,'veg','ALERT-FIXTURE')");
    await db.query("INSERT INTO admins(name,email,role) VALUES ('Fixture','fixture@example.invalid','admin')");
    const insert = async (source = 'kiosk', client = db) => (await client.query(`INSERT INTO orders
      (customer_id,order_number,status,order_source,subtotal,tax,total_amount) VALUES (1,$1,'Confirmed',$2,100,5,105) RETURNING id`,
    [`ALERT-${crypto.randomUUID().slice(0, 20)}`, source])).rows[0].id;
    const legacyId = await insert();
    const migration = await fs.readFile(new URL('../database/migrations/017_admin_order_notifications.sql', import.meta.url), 'utf8');
    await db.query(migration);
    await db.query(migration);
    Object.assign(process.env, { RESTAURANTAI_MODE: 'local', NODE_ENV: 'test', WHATSAPP_ENABLED: 'false',
      JWT_SECRET: 'admin-notification-fixture-only', RESTAURANTAI_ENV_FILE: path.join(root, 'absent.env') });
    const isolatedPool = {
      connect: () => db.connect(),
      query: (...args) => {
        const sql = typeof args[0] === 'string' ? args[0] : args[0].text;
        if (queueFails && sql.includes('INSERT INTO admin_order_notifications')) throw Object.assign(new Error('Fixture queue unavailable'), { code: 'FIXTURE_UNAVAILABLE' });
        return db.query(...args);
      },
    };
    mock.module('../src/config/database.js', { exports: { pool: isolatedPool } });
    mock.module('../src/services/kioskReceiptAutoPrintService.js', { exports: { requestKioskReceiptAutoPrint: () => {} } });
    const service = await import('../src/services/adminOrderNotificationService.js');
    const { default: adminRoutes } = await import('../src/routes/adminOrderRoutes.js');
    const { default: settingsRoutes } = await import('../src/routes/settingsRoutes.js');
    const { default: authRoutes } = await import('../src/routes/authRoutes.js');
    const { default: orderRoutes } = await import('../src/routes/orderRoutes.js');
    const { default: paymentRoutes } = await import('../src/routes/paymentRoutes.js');
    const { createOrder } = await import('../src/controllers/ordersController.js');
    const { createCashOrder } = await import('../src/controllers/paymentController.js');
    const { importCloudOrder } = await import('../src/services/cloudOrderImportService.js');
    const app = express();
    app.use(express.json());
    app.use('/api/admin/orders', adminRoutes);
    app.use('/api/settings', settingsRoutes);
    app.use('/api/auth', authRoutes);
    app.use('/api/orders', orderRoutes);
    app.use('/api/payments', paymentRoutes);
    app.post('/fixture/orders', createOrder);
    app.post('/fixture/cash', createCashOrder);
    const dist = fileURLToPath(new URL('../../admin/dist/', import.meta.url));
    app.use('/admin', express.static(dist));
    app.get(/^\/admin(?:\/.*)?$/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
    app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: 'Fixture request failed' }));
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const api = async (url, { role = 'admin', userId = 1, body, method } = {}) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}${url}`, {
        method: method || (body === undefined ? 'GET' : 'POST'),
        headers: { 'Content-Type': 'application/json', ...(role ? { Authorization: `Bearer ${jwt.sign({ id: userId, role }, process.env.JWT_SECRET)}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: await response.json() };
    };
    const eventCount = async id => Number((await db.query('SELECT COUNT(*) FROM admin_order_notifications WHERE order_id=$1', [id])).rows[0].count);
    const waitForEvent = async id => {
      for (let attempt = 0; attempt < 100; attempt++) {
        if (await eventCount(id)) return;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.fail('Post-commit hook did not create an event');
    };
    await t.test('additive migration is repeatable, suppresses old orders and preserves totals', async () => {
      await service.enqueueCommittedOrders();
      assert.equal(await eventCount(legacyId), 0);
      assert.equal(Number((await db.query('SELECT total_amount FROM orders WHERE id=$1', [legacyId])).rows[0].total_amount), 105);
      assert.doesNotMatch(migration, /^\s*(?:DROP|DELETE|TRUNCATE)\b/im);
    });
    await t.test('uncommitted/rolled-back rows are invisible; committed rows recover after a missed callback', async () => {
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        const rolledBack = await insert('kiosk', client);
        await service.enqueueCommittedOrders(db, rolledBack);
        assert.equal(await eventCount(rolledBack), 0);
        await client.query('ROLLBACK');
        await service.enqueueCommittedOrders();
        assert.equal(await eventCount(rolledBack), 0);
        await client.query('BEGIN');
        const committed = await insert('table_qr', client);
        await client.query('COMMIT');
        const fresh = await import('../src/services/adminOrderNotificationService.js?restart');
        assert.ok((await fresh.getPendingOrderNotifications()).notifications.some(row => Number(row.order_id) === committed));
      } finally { client.release(); }
    });
    await t.test('kiosk cash and table QR controllers enqueue after successful commit; retry does not duplicate', async () => {
      const tableToken = 'NOTIFY-FIXTURE-12345678';
      await db.query("INSERT INTO restaurant_tables(table_number,display_name,qr_token) VALUES ('NOTIFY-1','Fixture table',$1)", [tableToken]);
      for (const [url, source, extra] of [['/fixture/cash', 'kiosk', {}], ['/fixture/orders', 'table_qr', { table_token: tableToken }]]) {
        const body = { customer_id: 1, order_source: source, order_type: 'dine_in', payment_method: 'pay_at_counter',
          items: [{ menu_id: 1, quantity: 1 }], idempotency_key: crypto.randomUUID(), ...extra };
        const response = await api(url, { body });
        assert.equal(response.status, 201, JSON.stringify(response.body));
        const order = response.body.data.order || response.body.data;
        await waitForEvent(order.id);
        assert.equal(Number(order.total_amount), 105);
        assert.equal((await api(url, { body })).status, 200);
        await service.enqueueCommittedOrders();
        assert.equal(await eventCount(order.id), 1);
        const before = Number((await db.query('SELECT COUNT(*) FROM admin_order_notifications')).rows[0].count);
        assert.equal((await api(url, { body: { ...body, idempotency_key: crypto.randomUUID(), items: [{ menu_id: 99999, quantity: 1 }] } })).status, 400);
        await service.enqueueCommittedOrders();
        assert.equal(Number((await db.query('SELECT COUNT(*) FROM admin_order_notifications')).rows[0].count), before);
      }
    });
    await t.test('delayed cloud import, concurrent retries and fresh worker imports yield one durable event', async () => {
      const cloudOrder = { cloud_order_id: 7001, order_number: 'CLOUD-ALERT-7001', customer_name: 'Fixture', customer_phone: '+919876543210',
        status: 'Confirmed', order_type: 'pickup', payment_status: 'Pending', payment_method: 'Pay at Counter',
        created_at: '2020-01-01T00:00:00Z', subtotal: 100, tax: 5, delivery_charge: 0, discount: 0, total_amount: 105,
        items: [{ name: 'Fixture Roll', category: 'Fixture', barcode: 'ALERT-FIXTURE', quantity: 1, unit_price: 100, total_price: 100 }] };
      const origin = 'https://fixture.invalid/api';
      const results = await Promise.all([importCloudOrder(isolatedPool, cloudOrder, origin), importCloudOrder(isolatedPool, cloudOrder, origin)]);
      assert.equal(results.filter(row => row.duplicate).length, 1);
      const id = results[0].order.id;
      await waitForEvent(id);
      const fresh = await import('../src/services/cloudOrderImportService.js?restart');
      assert.equal((await fresh.importCloudOrder(isolatedPool, cloudOrder, origin)).duplicate, true);
      const { createCloudOrderSyncWorker } = await import('../src/services/cloudOrderSyncService.js');
      let pendingRequests = 0;
      for (let restart = 0; restart < 2; restart++) {
        const worker = createCloudOrderSyncWorker({ db: isolatedPool,
          config: { baseUrl: origin, secret: 'fixture-only', intervalMs: 10000 },
          fetchImpl: async url => {
            if (url.includes('/pending')) pendingRequests++;
            return Response.json({ success: true, data: url.includes('/pending') ? { orders: [cloudOrder] } : {} });
          },
        });
        try { await worker.tick(); } finally { await worker.stop(); }
      }
      assert.equal(pendingRequests, 2);
      assert.ok((await db.query('SELECT cloud_synced_at FROM orders WHERE id=$1', [id])).rows[0].cloud_synced_at);
      await Promise.all(Array.from({ length: 8 }, () => service.requestAdminOrderCreated(id)));
      assert.equal(await eventCount(id), 1);
      await assert.rejects(importCloudOrder(isolatedPool, { ...cloudOrder, cloud_order_id: 7002, total_amount: 1 }, origin));
      assert.equal((await db.query('SELECT id FROM orders WHERE cloud_order_id=7002')).rowCount, 0);
    });
    await t.test('notification outage cannot roll back cash order; pending API repairs it', async () => {
      queueFails = true;
      const response = await api('/fixture/cash', { body: { customer_id: 1, order_source: 'kiosk', order_type: 'dine_in',
        payment_method: 'pay_at_counter', items: [{ menu_id: 1, quantity: 1 }], idempotency_key: crypto.randomUUID() } });
      assert.equal(response.status, 201);
      const id = response.body.data.order.id;
      await service.requestAdminOrderCreated(id);
      assert.equal(await eventCount(id), 0);
      assert.equal(Number((await db.query('SELECT total_amount FROM orders WHERE id=$1', [id])).rows[0].total_amount), 105);
      assert.equal((await api('/api/admin/orders/notifications')).status, 503);
      queueFails = false;
      assert.ok((await service.getPendingOrderNotifications()).notifications.some(row => Number(row.order_id) === id));
    });
    await t.test('authenticated bounded pending API and idempotent acknowledgements persist across restart', async () => {
      for (const role of [null, 'kitchen_staff', 'manager']) {
        assert.equal((await api('/api/admin/orders/notifications', { role })).status, role ? 403 : 401);
        assert.equal((await api('/api/admin/orders/notifications/1/ack', { role, body: {} })).status, role ? 403 : 401);
      }
      assert.equal((await api('/api/admin/orders/notifications?limit=101')).status, 400);
      const page = await api('/api/admin/orders/notifications?limit=1');
      assert.equal(page.status, 200);
      assert.equal(page.body.data.notifications.length, 1);
      assert.equal(page.body.data.has_more, true);
      const id = page.body.data.notifications[0].order_id;
      const first = await api(`/api/admin/orders/notifications/${id}/ack`, { body: {} });
      assert.equal(first.status, 200);
      assert.deepEqual((await api(`/api/admin/orders/notifications/${id}/ack`, { role: 'staff', body: {} })).body.data, first.body.data);
      assert.equal((await service.acknowledgeOrderNotification(id, 2)).acknowledged_by, first.body.data.acknowledged_by);
      const fresh = await import('../src/services/adminOrderNotificationService.js?ack-restart');
      await fresh.requestAdminOrderCreated(id);
      assert.equal((await fresh.getPendingOrderNotifications()).notifications.some(row => row.order_id === id), false);
      assert.equal(await eventCount(id), 1);
      assert.equal((await api('/api/admin/orders/notifications/999999/ack', { body: {} })).status, 404);
      assert.equal((await api('/api/admin/orders/notifications/invalid/ack', { body: {} })).status, 400);
    });
    await t.test('POS and unconfirmed/cancelled orders do not generate arrivals', async () => {
      const pos = await insert('pos');
      const pending = await insert('kiosk');
      const cancelled = await insert('website');
      await db.query("UPDATE orders SET status='Pending' WHERE id=$1", [pending]);
      await db.query("UPDATE orders SET status='Cancelled' WHERE id=$1", [cancelled]);
      await service.enqueueCommittedOrders();
      for (const id of [pos, pending, cancelled]) assert.equal(await eventCount(id), 0);
    });
    await t.test('recovery drains multiple batches without timestamp or high-watermark losses', async () => {
      await db.query(`INSERT INTO orders(customer_id,order_number,status,order_source,subtotal,tax,total_amount)
        SELECT 1,'BACKLOG-' || n,'Confirmed','website',100,5,105 FROM generate_series(1,205) n`);
      assert.equal((await service.enqueueCommittedOrders()).rowCount, 200);
      const newest = (await db.query("SELECT id FROM orders WHERE order_number='BACKLOG-205'")).rows[0].id;
      const oldest = (await db.query("SELECT id FROM orders WHERE order_number='BACKLOG-1'")).rows[0].id;
      assert.equal(await eventCount(newest), 1, 'newest missed callback recovers before older backlog');
      assert.equal(await eventCount(oldest), 0);
      assert.equal((await service.enqueueCommittedOrders()).rowCount, 5);
      assert.equal((await service.enqueueCommittedOrders()).rowCount, 0);
      assert.equal(Number((await db.query("SELECT COUNT(*) FROM admin_order_notifications WHERE payload->>'order_number' LIKE 'BACKLOG-%'")).rows[0].count), 205);
    });
    await t.test('150 old unacknowledged notifications cannot hide the latest order; metadata is current and private', async () => {
      await db.query(`INSERT INTO orders(customer_id,order_number,status,order_source,subtotal,tax,total_amount)
        SELECT 1,'OLD-PENDING-' || n,'Confirmed','website',100,5,105 FROM generate_series(1,150) n`);
      await service.enqueueCommittedOrders();
      assert.equal(Number((await db.query("SELECT COUNT(*) FROM admin_order_notifications WHERE acknowledged_at IS NULL AND payload->>'order_number' LIKE 'OLD-PENDING-%'")).rows[0].count), 150);
      const id = await insert('table_qr');
      await db.query(`INSERT INTO order_items(order_id,menu_id,quantity,unit_price,total_price,special_instructions)
        VALUES ($1,1,2,20,40,'PRIVATE ITEM NOTE'),($1,1,3,20,60,'PRIVATE ITEM NOTE')`, [id]);
      await db.query("UPDATE orders SET customer_name='PRIVATE NAME',customer_phone='9999999999',delivery_address='PRIVATE ADDRESS' WHERE id=$1", [id]);
      const response = await api('/api/admin/orders/notifications?limit=100');
      assert.equal(response.status, 200);
      const page = response.body.data;
      assert.equal(Number(page.notifications[0].order_id), id);
      assert.equal(page.notifications.length, 100);
      assert.equal(page.has_more, true);
      assert.equal(page.next_cursor, String(page.notifications.at(-1).order_id));
      const first = page.notifications[0];
      assert.equal(first.item_count, 2, 'line count must not be quantity sum or duplicate the notification');
      assert.equal(Number(first.grand_total), 105, 'saved total must not multiply with item rows');
      assert.equal(first.status, 'Confirmed');
      assert.deepEqual(Object.keys(first).sort(), ['order_id', 'event_type', 'payload', 'created_at', 'item_count', 'grand_total', 'status'].sort());
      assert.deepEqual(Object.keys(first.payload).sort(), ['order_id', 'order_number', 'order_source', 'order_type', 'table_number', 'token_number'].sort());
      assert.doesNotMatch(JSON.stringify(page), /PRIVATE|9999999999/);
    });
    await t.test('cursor pages exhaust the backlog without skips or duplicates during a concurrent arrival', async () => {
      const expected = (await db.query(`SELECT n.order_id FROM admin_order_notifications n JOIN orders o ON o.id=n.order_id
        WHERE n.acknowledged_at IS NULL AND LOWER(o.status)='confirmed' ORDER BY n.order_id DESC`)).rows.map(row => String(row.order_id));
      let cursor = null, newcomer, pages = 0;
      const seen = [];
      do {
        const response = await api(`/api/admin/orders/notifications?limit=37${cursor ? `&cursor=${cursor}` : ''}`);
        assert.equal(response.status, 200);
        const page = response.body.data;
        assert.ok(page.notifications.length <= 37);
        seen.push(...page.notifications.map(row => String(row.order_id)));
        assert.equal(page.has_more, page.next_cursor !== null);
        if (cursor) assert.ok(page.notifications.every(row => BigInt(row.order_id) < BigInt(cursor)));
        cursor = page.next_cursor;
        if (++pages === 1) newcomer = await insert('website');
        assert.ok(pages < 30, 'pagination must terminate');
      } while (cursor);
      assert.ok(pages > 1);
      assert.deepEqual(seen, expected);
      assert.equal(new Set(seen).size, seen.length);
      assert.equal(Number((await api('/api/admin/orders/notifications?limit=1')).body.data.notifications[0].order_id), newcomer);
      const empty = await api('/api/admin/orders/notifications?cursor=1');
      assert.deepEqual(empty.body.data, { notifications: [], has_more: false, next_cursor: null });
      for (const cursorValue of ['', '0', '-1', 'abc', '1.5', '9223372036854775808', '1 OR 1=1']) {
        assert.equal((await api(`/api/admin/orders/notifications?cursor=${encodeURIComponent(cursorValue)}`)).status, 400);
      }
      assert.equal((await api('/api/admin/orders/notifications?cursor=1&cursor=2')).status, 400);
    });
    await t.test('accepted, cancelled, completed and other progressed orders leave pending without acknowledgement', async () => {
      for (const status of ['Accepted', 'Cancelled', 'Completed', 'Preparing', 'Ready']) {
        const id = await insert();
        await service.requestAdminOrderCreated(id);
        assert.equal(Number((await service.getPendingOrderNotifications(db, 1)).notifications[0].order_id), id);
        await db.query('UPDATE orders SET status=$2 WHERE id=$1', [id, status]);
        const page = await api('/api/admin/orders/notifications?limit=100');
        assert.equal(page.status, 200);
        assert.equal(page.body.data.notifications.some(row => Number(row.order_id) === id), false);
        const event = (await db.query('SELECT acknowledged_at FROM admin_order_notifications WHERE order_id=$1', [id])).rows[0];
        assert.equal(event.acknowledged_at, null, 'filter must not silently acknowledge or delete events');
      }
    });
    await t.test('notification policy uses existing app_settings, preserves other settings and excludes device data', async () => {
      const defaults = await api('/api/settings/order-notifications');
      assert.equal(defaults.status, 200);
      assert.equal(defaults.body.data.orderNotificationAutoNavigate, 'false');
      assert.equal(defaults.body.data.orderNotificationRepeatSeconds, '0');
      assert.ok(Object.keys(defaults.body.data).every(key => key.startsWith('orderNotification')));
      await api('/api/settings', { method: 'PUT', body: { restaurantName: 'Preserved Restaurant', receiptWidth: '58' } });
      const policy = { orderNotificationPopup: 'false', orderNotificationSound: 'true', orderNotificationVoice: 'true',
        orderNotificationLanguage: 'hi', orderNotificationRepeatSeconds: '60', orderNotificationAutoNavigate: 'false' };
      const saved = await api('/api/settings', { method: 'PUT', body: { ...policy, volume: 25, audioUnlocked: true, desktopPermission: 'granted' } });
      assert.equal(saved.status, 200);
      assert.equal(saved.body.data.restaurantName, 'Preserved Restaurant');
      assert.equal(saved.body.data.receiptWidth, '58');
      assert.deepEqual((await api('/api/settings/order-notifications')).body.data, policy);
      const stored = (await db.query("SELECT value FROM app_settings WHERE key='restaurant'")).rows[0].value;
      for (const key of ['volume', 'audioUnlocked', 'desktopPermission']) assert.equal(Object.hasOwn(stored, key), false);
      assert.equal(Object.keys((await api('/api/settings/public', { role: null })).body.data).some(key => key.startsWith('orderNotification')), false);
      for (const [key, value] of [['orderNotificationPopup', 'yes'], ['orderNotificationLanguage', 'fr'], ['orderNotificationRepeatSeconds', '1']]) {
        assert.equal((await api('/api/settings', { method: 'PUT', body: { [key]: value } })).status, 400);
      }
      assert.deepEqual((await api('/api/settings/order-notifications')).body.data, policy);
    });
    await t.test('notification policy is authenticated, staff read-only, and admin-only to save', async () => {
      assert.equal((await api('/api/settings/order-notifications', { role: null })).status, 401);
      assert.equal((await api('/api/settings/order-notifications', { role: 'kitchen_staff' })).status, 403);
      assert.equal((await api('/api/settings/order-notifications', { role: 'staff' })).status, 200);
      assert.equal((await api('/api/settings', { role: 'staff' })).status, 403);
      assert.equal((await api('/api/settings', { role: 'staff', method: 'PUT', body: { orderNotificationVoice: 'false' } })).status, 403);
    });
    await t.test('real API/browser E2E: three sources, two sessions, backlog, acknowledgement and unchanged finances', async () => {
      await fs.access(path.join(dist, 'index.html'));
      const secondAdmin = (await db.query("INSERT INTO admins(name,email,role) VALUES ('Second fixture','second@example.invalid','admin') RETURNING id")).rows[0].id;
      assert.equal((await api('/api/settings', { method: 'PUT', body: {
        orderNotificationPopup: 'true', orderNotificationSound: 'false', orderNotificationVoice: 'false',
        orderNotificationLanguage: 'en', orderNotificationRepeatSeconds: '0', orderNotificationAutoNavigate: 'false',
      } })).status, 200);
      assert.equal(Number((await db.query("SELECT COUNT(*) FROM admin_order_notifications WHERE acknowledged_at IS NULL AND payload->>'order_number' LIKE 'OLD-PENDING-%'")).rows[0].count), 150);
      const checkout = async (url, source, quantity, extra = {}) => {
        const response = await api(url, { role: null, body: {
          customer_id: 1, order_source: source, order_type: 'dine_in', payment_method: 'pay_at_counter',
          items: [{ menu_id: 1, quantity }], idempotency_key: crypto.randomUUID(), ...extra,
        } });
        assert.equal(response.status, 201, JSON.stringify(response.body));
        const order = response.body.data.order || response.body.data;
        await waitForEvent(order.id);
        assert.equal(Number(order.total_amount), quantity * 105);
        return order;
      };
      const kiosk = await checkout('/api/payments/cash-order', 'kiosk', 2);
      const qr = await checkout('/api/orders', 'table_qr', 3, { table_token: 'NOTIFY-FIXTURE-12345678' });
      const cloudInput = { cloud_order_id: 8001, order_number: 'CLOUD-E2E-8001', customer_name: 'Fixture',
        customer_phone: '+919876543210', status: 'Confirmed', order_type: 'pickup', payment_status: 'Pending',
        payment_method: 'Pay at Counter', created_at: '2020-01-01T00:00:00Z', subtotal: 400, tax: 20,
        delivery_charge: 0, discount: 0, total_amount: 420,
        items: [{ name: 'Fixture Roll', category: 'Fixture', barcode: 'ALERT-FIXTURE', quantity: 4, unit_price: 100, total_price: 400 }] };
      const cloud = (await importCloudOrder(isolatedPool, cloudInput, 'https://fixture.invalid/api')).order;
      assert.equal((await importCloudOrder(isolatedPool, cloudInput, 'https://fixture.invalid/api')).duplicate, true);
      await waitForEvent(cloud.id);
      const ids = [kiosk.id, qr.id, cloud.id];
      const pending = (await api('/api/admin/orders/notifications?limit=100')).body.data;
      assert.equal(pending.has_more, true);
      assert.equal(Number(pending.notifications[0].order_id), cloud.id);
      for (const id of ids) {
        assert.equal(await eventCount(id), 1);
        assert.equal(pending.notifications.filter(row => Number(row.order_id) === id).length, 1);
      }
      const finances = async () => ({
        orders: (await db.query(`SELECT id,subtotal,tax,delivery_charge,discount,total_amount,payment_status,payment_method
          FROM orders WHERE id=ANY($1) ORDER BY id`, [ids])).rows,
        items: (await db.query('SELECT order_id,quantity,unit_price,total_price FROM order_items WHERE order_id=ANY($1) ORDER BY id', [ids])).rows,
        payments: (await db.query('SELECT * FROM payments WHERE order_id=ANY($1) ORDER BY id', [ids])).rows,
      });
      const before = await finances();
      assert.equal((await api(`/api/admin/orders/${kiosk.id}/status`, { role: null, method: 'PATCH', body: { status: 'Accepted' } })).status, 401);
      let browser;
      const errors = [], outsideRequests = [];
      const origin = `http://127.0.0.1:${server.address().port}`;
      const popup = page => page.getByRole('region', { name: 'New order notification' });
      const refresh = page => page.evaluate(() => window.dispatchEvent(new Event('online')));
      const row = async id => (await db.query(`SELECT o.status,n.acknowledged_by FROM orders o
        JOIN admin_order_notifications n ON n.order_id=o.id WHERE o.id=$1`, [id])).rows[0];
      try {
        browser = await chromium.launch({ channel: 'msedge', headless: true });
        const pages = [];
        for (const userId of [1, secondAdmin]) {
          const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
          await context.route('**/*', route => {
            if (new URL(route.request().url()).origin === origin) return route.continue();
            outsideRequests.push(route.request().url()); return route.abort();
          });
          await context.addInitScript(({ origin, token }) => {
            if (location.origin === origin) localStorage.setItem('authToken', token);
          }, { origin, token: jwt.sign({ id: userId, role: 'admin' }, process.env.JWT_SECRET) });
          const page = await context.newPage();
          page.setDefaultTimeout(15000);
          page.on('pageerror', error => errors.push(error.message));
          await page.goto(origin + '/admin/orders');
          await popup(page).getByText(cloud.order_number, { exact: true }).waitFor();
          await popup(page).getByText('100+ pending', { exact: true }).waitFor();
          assert.equal(await popup(page).count(), 1);
          pages.push(page);
        }
        const [first, second] = pages;
        await popup(second).getByRole('button', { name: 'Acknowledge', exact: true }).click();
        await popup(second).getByText(qr.order_number, { exact: true }).waitFor();
        assert.deepEqual(await row(cloud.id), { status: 'Confirmed', acknowledged_by: String(secondAdmin) });
        await refresh(first);
        await popup(first).getByText(qr.order_number, { exact: true }).waitFor();
        await first.reload();
        await popup(first).getByText(qr.order_number, { exact: true }).waitFor();
        await popup(first).getByRole('button', { name: 'Snooze 5 min', exact: true }).click();
        await popup(first).getByText(kiosk.order_number, { exact: true }).waitFor();
        await popup(second).getByText(qr.order_number, { exact: true }).waitFor();
        assert.deepEqual(await row(qr.id), { status: 'Confirmed', acknowledged_by: null });
        await popup(second).getByRole('button', { name: 'Dismiss', exact: true }).click();
        await popup(second).getByText(kiosk.order_number, { exact: true }).waitFor();
        const accepted = first.waitForResponse(response => response.url().endsWith(`/api/admin/orders/${kiosk.id}/status`) && response.request().method() === 'PATCH');
        await popup(first).getByRole('button', { name: 'Accept', exact: true }).click();
        assert.equal((await accepted).status(), 200);
        assert.deepEqual(await row(kiosk.id), { status: 'Accepted', acknowledged_by: null });
        await refresh(second);
        await second.waitForFunction(number => !document.querySelector('[aria-label="New order notification"]')?.textContent.includes(number), kiosk.order_number);
        assert.deepEqual(await finances(), before, 'notification actions must not alter checkout or persisted payment values');
        const paid = await api(`/api/payments/${kiosk.id}/mark-paid`, {
          method: 'PATCH', body: { payment_method: 'cash', expected_total: 210 },
        });
        assert.equal(paid.status, 200, JSON.stringify(paid.body));
        assert.equal(Number(paid.body.data.total_amount), 210);
        assert.equal(Number((await db.query('SELECT total_amount FROM orders WHERE id=$1', [kiosk.id])).rows[0].total_amount), 210);
        assert.equal(Number((await db.query("SELECT SUM(amount) AS paid FROM payments WHERE order_id=$1 AND LOWER(payment_status) IN ('paid','success','completed')", [kiosk.id])).rows[0].paid), 210);
        for (const id of ids) assert.equal(await eventCount(id), 1);
        assert.equal((await api('/api/admin/orders/notifications')).body.data.notifications.some(n => [cloud.id, kiosk.id].includes(Number(n.order_id))), false);
        assert.deepEqual(errors, []);
        assert.deepEqual(outsideRequests.filter(url => new URL(url).pathname.startsWith('/api/')), [], 'no API request may escape the isolated server');
      } finally { await browser?.close(); }
    });
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    if (db) await db.end();
    if (started || await fs.access(path.join(data, 'postmaster.pid')).then(() => true, () => false)) {
      await exec(executable('pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop'], { windowsHide: true, timeout: 30000 });
    }
    assert.equal(await fs.access(path.join(data, 'postmaster.pid')).then(() => true, () => false), false, 'test PostgreSQL must stop');
    for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
    Object.assign(process.env, savedEnv);
    console.log(`No test PostgreSQL remains running; fixture artifacts: ${root}`);
  }
});
