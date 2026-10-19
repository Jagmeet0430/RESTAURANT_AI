import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import express from 'express';
import jwt from 'jsonwebtoken';

test('host printer management, canonical receipts and authenticated API (no real printer/DB)', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'restaurantai-printer-api-'));
  const savedEnv = { ...process.env };
  Object.assign(process.env, { RESTAURANTAI_PRINTER_STATE_ROOT: root, RESTAURANTAI_MODE: 'local',
    NODE_ENV: 'test', JWT_SECRET: 'printer-test-fixture-secret', WHATSAPP_ENABLED: 'false' });
  delete process.env.RESTAURANTAI_PRINTER_CONFIG;
  let offline = false, discoveryFails = false, spoolFails = false, spoolCount = 0;
  const jobs = [];
  const printers = [{ name: 'EC58B fixture', driver: 'Fixture Windows driver', port: 'USB001', status: 'Normal',
    offline: false, virtual: false, paperWidthsMm: [58, 80], printableWidthMm: 48 }];
  const exec = () => {};
  exec[promisify.custom] = async (exe, args, options) => {
    assert.equal(options.windowsHide, true);
    if (args.includes('-AsJson')) {
      if (discoveryFails) throw new Error('fixture discovery unavailable');
      return { stdout: JSON.stringify(printers.map(row => ({ ...row, offline }))), stderr: '' };
    }
    assert.ok(args.includes('-JobPath'));
    const job = JSON.parse(await fs.readFile(args[args.indexOf('-JobPath') + 1], 'utf8'));
    jobs.push(job); spoolCount++;
    await new Promise(resolve => setTimeout(resolve, 50));
    if (spoolFails) throw new Error('fixture spool failure');
    return { stdout: 'fixture job accepted', stderr: '' };
  };
  const receipt = { source_type: 'order', source_id: 17, bill_number: 'BILL-17', order_number: 'ORDER-17', token_number: 101,
    created_at: '2026-10-18T06:00:00Z', order_type: 'pickup', customer_name: 'Fixture', payment_method: 'Cash', payment_status: 'Paid',
    restaurant: { restaurant_name: 'Mahesh Sweets and Bakers', address: 'Fixture address', gstin: '03ABCDE1234F1Z5' },
    items: [{ name: 'Extra long cheese corn roll with multiple toppings and sauce', quantity: 2, unit_price: 45, total_price: 90 }],
    totals: { subtotal: 90, tax: 4.5, discount: 0, packing: 10, grand_total: 104.5 } };
  mock.module('node:child_process', { exports: { execFile: exec } });
  mock.module('../src/config/database.js', { exports: { pool: { query: () => { throw new Error('No database access allowed'); } } } });
  mock.module('../src/services/billingService.js', { exports: {
    getOrderReceipt: async () => structuredClone(receipt), getReceipt: async () => structuredClone(receipt),
    getTestReceipt: async () => ({ ...structuredClone(receipt), source_type: 'test' }),
  } });
  const service = await import('../src/services/printerManagementService.js');
  const rendering = await import('../src/services/receiptPrinterService.js');
  const config = { enabled: true, printerName: 'EC58B fixture', kitchenPrinterName: '', paperWidth: '58mm', copies: 1,
    autoPrintKioskOrders: true, printMode: 'windows_driver', fontScale: 1, lineSpacing: 1, charactersPerLine: 28,
    logoPrinting: false, autoCut: 'driver' };
  let server;
  try {
    await t.test('discovery comes from host and capabilities do not invent raw support', async () => {
      const data = await service.getPrinterManagement();
      assert.equal(data.printers[0].printableWidthMm, 48);
      assert.deepEqual(data.capabilities.printModes, ['windows_driver']);
      assert.equal(data.capabilities.autoCut, false);
      assert.ok(!('configPath' in data));
      assert.equal(service.supportsReceiptPaper({ paperWidthsMm: [48.01] }, '58mm'), true);
      assert.equal(service.supportsReceiptPaper({ paperWidthsMm: [48.01] }, '80mm'), false);
      assert.equal(service.supportsReceiptPaper({ paperWidthsMm: [72] }, '80mm'), true);
      assert.equal(service.supportsReceiptPaper({ paperWidthsMm: [210] }, '58mm'), false);
    });
    await t.test('legacy BOM configuration loads without resetting the working kiosk configuration', async () => {
      const file = rendering.getPrinterConfigPath();
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, '\uFEFF' + JSON.stringify({ enabled: true, printerName: 'EC58B fixture', paperWidth: '58mm', copies: 2 }));
      const result = await rendering.getPrinterConfig();
      assert.equal(result.config.enabled, true); assert.equal(result.config.copies, 2);
    });
    await t.test('save validates host selection, values, unsupported modes and paths', async () => {
      for (const bad of [{ copies: 0 }, { copies: 6 }, { enabled: 'false' }, { paperWidth: 'A4' },
        { printMode: 'raw_escpos' }, { logoPrinting: true }, { autoCut: true }, { fontScale: 8 }, { lineSpacing: 0 },
        { printerName: 'fake; command' }, { configPath: 'C:/bad.json' }, { printerName: 'bad\nname' }]) {
        await assert.rejects(service.savePrinterSettings({ ...config, ...bad }), { statusCode: 400 });
      }
      const saved = await service.savePrinterSettings(config);
      assert.deepEqual(saved, config);
    });
    await t.test('saved settings survive fresh module loading with unchanged persistent path', async () => {
      const fresh = await import('../src/services/receiptPrinterService.js?restart-fixture');
      assert.deepEqual((await fresh.getPrinterConfig()).config, config);
      assert.equal(fresh.getPrinterConfigPath(), path.join(root, 'config/printer.json'));
    });
    await t.test('48mm EC58B driver form accepts 58mm roll but rejects 80mm before spooling', async () => {
      printers[0].paperWidthsMm = [48.01];
      try {
        await assert.rejects(service.savePrinterSettings({ ...config, paperWidth: '80mm' }), { statusCode: 400 });
        assert.deepEqual(await service.savePrinterSettings(config), config);
        await fs.writeFile(rendering.getPrinterConfigPath(), JSON.stringify({ ...config, paperWidth: '80mm' }));
        await assert.rejects(service.printSavedReceipt(null, 'order', '17', crypto.randomUUID()), { statusCode: 409 });
        assert.equal(spoolCount, 0);
      } finally { printers[0].paperWidthsMm = [58, 80]; await service.savePrinterSettings(config); }
    });
    await t.test('Admin/POS/test previews share kiosk layout and preserve historical totals', async () => {
      for (const source of ['order', 'pos', 'test']) {
        const preview = await service.previewSavedReceipt(null, source, '17');
        assert.deepEqual(preview.layout, rendering.buildThermalReceiptLayout(preview.receipt, config));
        assert.equal(preview.receipt.totals.grand_total, 104.5);
        for (const value of ['GSTIN:', 'Total Quantity', 'SGST 2.5%', 'CGST 2.5%', 'Packing', 'Grand Total', '104.50', 'Powered by Algosophix']) assert.ok(preview.text.includes(value), value);
        assert.ok(preview.text.split('\r\n').every(line => line.length <= 28));
      }
    });
    await t.test('concurrent/restarted retries queue one job with explicit host printer and never claim physical output', async () => {
      const key = crypto.randomUUID();
      const results = await Promise.all([service.printSavedReceipt(null, 'order', '17', key), service.printSavedReceipt(null, 'order', '17', key)]);
      assert.ok(results.some(row => row.status === 'queued'));
      assert.equal(spoolCount, 1); assert.ok(results.every(row => row.confirmed === false));
      assert.equal(jobs[0].printerName, 'EC58B fixture');
      assert.deepEqual(jobs[0].layout, rendering.buildThermalReceiptLayout(receipt, config, { duplicate: true }));
      const fresh = await import('../src/services/printerManagementService.js?restart-fixture');
      assert.equal((await fresh.printSavedReceipt(null, 'order', '17', key)).status, 'queued');
      assert.equal(spoolCount, 1);
      await assert.rejects(service.printSavedReceipt(null, 'pos', '18', key), { statusCode: 409 });
    });
    await t.test('offline/missing spooler rejects; ambiguous failure never silently resubmits', async () => {
      offline = true;
      await assert.rejects(service.printSavedReceipt(null, 'order', '17', crypto.randomUUID()), { statusCode: 503 });
      assert.equal(spoolCount, 1); offline = false;
      discoveryFails = true;
      assert.match((await service.getPrinterManagement()).connectionError, /discovery failed/);
      discoveryFails = false; spoolFails = true;
      const key = crypto.randomUUID();
      assert.equal((await service.printSavedReceipt(null, 'order', '17', key)).status, 'unknown');
      spoolFails = false;
      assert.equal((await service.printSavedReceipt(null, 'order', '17', key)).status, 'unknown');
      assert.equal(spoolCount, 2);
    });
    await t.test('configuration and test printing require Admin; operators can print saved bills', async () => {
      const { default: routes } = await import('../src/routes/receiptPrinterRoutes.js');
      const app = express(); app.use(express.json()); app.use('/api/receipt-printer', routes);
      app.use((error, req, res, next) => res.status(500).json({ message: 'Fixture request failed' }));
      server = await new Promise(resolve => { const value = app.listen(0, '127.0.0.1', () => resolve(value)); });
      const request = async (route, role, method = 'GET', body) => fetch(`http://127.0.0.1:${server.address().port}/api/receipt-printer${route}`, {
        method, headers: { 'Content-Type': 'application/json', ...(role ? { Authorization: `Bearer ${jwt.sign({ id: 1, role }, process.env.JWT_SECRET)}` } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      for (const [route, method, body] of [['/settings', 'GET'], ['/settings', 'PUT', config], ['/test', 'POST', { requestId: crypto.randomUUID() }]]) {
        assert.equal((await request(route, null, method, body)).status, 401);
        assert.equal((await request(route, 'staff', method, body)).status, 403);
        assert.equal((await request(route, 'admin', method, body)).status, 200);
      }
      assert.equal((await request('/print/test/preview', 'staff', 'POST', { requestId: crypto.randomUUID() })).status, 403);
      assert.equal((await request('/print/order/17', 'staff', 'POST', { requestId: crypto.randomUUID() })).status, 200);
      assert.equal((await request('/preview/order/17')).status, 401);
    });
    await t.test('cloud backend cannot access local printer control', async () => {
      process.env.RESTAURANTAI_MODE = 'online';
      await assert.rejects(service.savePrinterSettings(config), { statusCode: 503 });
      await assert.rejects(service.printSavedReceipt(null, 'order', '17', crypto.randomUUID()), { statusCode: 503 });
      process.env.RESTAURANTAI_MODE = 'local';
    });
    await t.test('installer preserves printer.json; defaults do not replace live configuration', async () => {
      const iss = await fs.readFile(new URL('../../installer/RestaurantAI.iss', import.meta.url), 'utf8');
      assert.match(iss, /printer\.example\.json[^\r\n]+onlyifdoesntexist[^\r\n]+uninsneveruninstall/);
      assert.ok(!/Source: [^\r\n]*[\\/]printer\.json/.test(iss));
    });
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    assert.ok(root.startsWith(path.join(os.tmpdir(), 'restaurantai-printer-api-')));
    await fs.rm(root, { recursive: true, force: true });
    for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
    Object.assign(process.env, savedEnv);
  }
});
