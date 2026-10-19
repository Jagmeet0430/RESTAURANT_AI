// Isolated browser/API fixtures. No database, SMS provider or physical printer is used.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

test('kiosk attract activity, checkout protection and session privacy', { timeout: 120000 }, async t => {
  const frontend = path.resolve(__dirname, '../frontend');
  const requests = [], orders = new Map();
  let cashMode = 'ok', printMode = 'ok';
  const heldCash = [], heldPrint = [];
  const send = (res, data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: status < 400, data })); };
  const orderFor = body => {
    if (!orders.has(body.idempotency_key)) orders.set(body.idempotency_key, { id: orders.size + 101, order_number: `TEST-${orders.size + 101}`, token_number: 27, total_amount: 94.5 });
    return { order: orders.get(body.idempotency_key) };
  };
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
        requests.push({ path: url.pathname, body, method: req.method });
        if (url.pathname === '/api/payments/cash-order') {
          const data = orderFor(body);
          if (cashMode === 'hold') { heldCash.push(() => send(res, data)); return; }
          return send(res, cashMode === 'lost' ? {} : data, cashMode === 'lost' ? 500 : 200);
        }
        if (url.pathname.startsWith('/api/receipt-printer/')) {
          if (printMode === 'hold') { heldPrint.push(() => send(res, { printed: true, queued: true })); return; }
          return send(res, { printed: true, queued: true });
        }
        const data = url.pathname === '/api/menu'
          ? Array.from({ length: 20 }, (_, index) => ({ id: index + 1, name: `Cheese Corn Roll ${index + 1}`, category: 'Snacks', price: 90, is_available: true }))
          : url.pathname === '/api/settings/public' ? { restaurantName: 'Mahesh sweets and Bakers', kioskDisplayMode: 'auto' }
          : url.pathname.startsWith('/api/customers/phone/') ? { id: 8, name: 'Private Guest', phone: '9000000000' }
          : { online_enabled: false };
        return send(res, data);
      }
      const relative = url.pathname === '/customer' || url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).slice(1);
      const file = path.resolve(frontend, relative);
      if (!file.startsWith(frontend + path.sep)) { res.writeHead(403); return res.end(); }
      const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png' };
      const data = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); res.end(data);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: process.env.KIOSK_TEST_BROWSER || 'msedge', headless: true });
  async function open(extra = '') {
    const page = await browser.newPage({ viewport: { width: 768, height: 1366 }, hasTouch: true });
    page.setDefaultTimeout(8000);
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.addInitScript(api => { window.RESTAURANTAI_API_BASE_URL = api; }, origin + '/api');
    await page.goto(`${origin}/customer?kiosk=1${extra}`, { waitUntil: 'networkidle' });
    return page;
  }
  async function menu(page) {
    await page.getByRole('button', { name: 'Start order', exact: true }).click();
    await page.waitForTimeout(500);
    await page.locator('[data-kiosk-order-type="dine_in"]').click();
    await page.locator('.kiosk-menu-item').first().waitFor();
  }
  async function clock(page) { await page.clock.install(); await page.clock.pauseAt(new Date()); await page.keyboard.press('Shift'); }
  const screen = page => page.locator('.kiosk-app').getAttribute('data-kiosk-screen');
  async function review(page) {
    await menu(page);
    await page.locator('[data-kiosk-add="1"]').click();
    await page.locator('[data-kiosk-action="details"]').click();
    await page.getByLabel('Customer name', { exact: true }).click();
    await page.getByLabel('Customer name', { exact: true }).fill('Private Guest');
    await page.getByLabel('Customer phone number', { exact: true }).click();
    await page.getByLabel('Customer phone number', { exact: true }).fill('9000000000');
    await page.getByRole('button', { name: 'Close keypad', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => [state.kiosk.customerName, state.kiosk.customerPhone]), ['Private Guest', '9000000000']);
    await page.locator('[data-kiosk-action="payment"]').click();
    await page.locator('[data-kiosk-action="review"]').click();
  }
  try {
    await t.test('touch anywhere and mouse start once; reduced motion disables both animations', async () => {
      const page = await open();
      try {
        assert.equal(await screen(page), 'welcome');
        await page.touchscreen.tap(20, 30); // Header, not just the visual call-to-action.
        assert.equal(await screen(page), 'order_type');
        await page.locator('[data-kiosk-order-type="dine_in"]').evaluate(button => button.click());
        assert.equal(await screen(page), 'order_type', 'second touch cannot select an order type');
        await page.evaluate(() => resetKioskSession());
        await page.emulateMedia({ reducedMotion: 'reduce' });
        assert.deepEqual(await page.locator('.kiosk-attract h1, .kiosk-attract-hand').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).animationName)), ['none', 'none']);
        await page.mouse.click(30, 1100);
        assert.equal(await screen(page), 'order_type');
      } finally { await page.close(); }
    });
    await t.test('60 second empty-cart idle; wheel/key activity extends it, polling does not', async () => {
      const page = await open();
      try {
        await menu(page); await clock(page);
        await page.clock.runFor(55000);
        await page.evaluate(() => { window.fixtureWheelSeen = false; window.addEventListener('wheel', () => { window.fixtureWheelSeen = true; }, { once: true }); });
        await page.mouse.move(350, 450); await page.mouse.wheel(0, 500);
        await page.waitForTimeout(100);
        assert.equal(await page.evaluate(() => window.fixtureWheelSeen), true);
        await page.clock.runFor(55000);
        assert.equal(await screen(page), 'menu');
        await page.keyboard.press('ArrowDown');
        await page.clock.runFor(59000);
        assert.equal(await screen(page), 'menu');
        await page.clock.runFor(2000);
        assert.equal(await screen(page), 'welcome');
        assert.equal(await page.locator('.kiosk-idle-dialog').count(), 0);
      } finally { await page.close(); }
    });
    await t.test('cart warning countdown, Continue, Start over and personal-state cleanup', async () => {
      const page = await open();
      try {
        await menu(page); await page.locator('[data-kiosk-add="1"]').click();
        await page.evaluate(() => {
          state.kiosk.customerName = 'Private Guest'; state.kiosk.customerPhone = '9000000000';
          state.kiosk.keyboard.activeField = 'name'; state.phoneVerification.token = 'fixture-otp-token'; state.trackOrders.orders = [{ id: 42 }];
        });
        await clock(page); await page.clock.runFor(61000);
        assert.match(await page.locator('.kiosk-idle-dialog').innerText(), /Are you still ordering/);
        assert.equal(await page.locator('#kioskIdleCountdown').innerText(), '14');
        await page.getByRole('button', { name: 'Continue ordering', exact: true }).click();
        assert.equal(await page.evaluate(() => state.cart[0].qty), 1);
        await page.clock.runFor(61000);
        await page.locator('.kiosk-idle-dialog [data-kiosk-action="new-order"]').click();
        assert.equal(await screen(page), 'welcome');
        const cleared = await page.evaluate(() => ({ cart: state.cart, name: state.kiosk.customerName, phone: state.kiosk.customerPhone,
          field: state.kiosk.keyboard.activeField, verification: state.phoneVerification.token, tracking: state.trackOrders.orders,
          confirmation: state.confirmation, orderType: state.kiosk.orderType, menuCount: menuItems.length, restaurant: state.restaurantSettings.restaurantName }));
        assert.deepEqual(cleared, { cart: [], name: '', phone: '', field: '', verification: '', tracking: [], confirmation: null, orderType: '', menuCount: 20, restaurant: 'Mahesh sweets and Bakers' });
        assert.ok(!(await page.locator('body').innerText()).includes('Private Guest'));
      } finally { await page.close(); }
    });
    await t.test('configured timeout and grace reset only the abandoned local cart', async () => {
      const page = await open('&kioskIdleSeconds=30&kioskIdleGraceSeconds=5');
      try {
        await menu(page); await page.locator('[data-kiosk-add="1"]').click(); await clock(page);
        const count = orders.size;
        await page.clock.runFor(31000); assert.equal(await page.locator('.kiosk-idle-dialog').count(), 1);
        await page.clock.runFor(5000); assert.equal(await screen(page), 'welcome');
        assert.equal(await page.evaluate(() => state.cart.length), 0); assert.equal(orders.size, count);
        assert.equal(await page.evaluate(() => window.restaurantKioskTimerDebug.idleCountdownCount), 0);
      } finally { await page.close(); }
    });
    await t.test('pending submission and printing block reset; success retains receipt then clears privacy', async () => {
      const page = await open('&kioskIdleSeconds=30&kioskResetSeconds=5');
      cashMode = 'hold'; printMode = 'hold';
      try {
        await review(page); await clock(page);
        const count = orders.size;
        await page.locator('[data-kiosk-action="place-order"]').evaluate(button => { button.click(); button.click(); });
        await page.waitForResponse(response => response.url().includes('/customers/phone/'));
        // Wait for the server-side fixture to receive the held submission.
        for (let i = 0; !heldCash.length && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 10));
        assert.equal(heldCash.length, 1);
        await page.clock.runFor(20000);
        assert.equal(await page.evaluate(() => state.isSubmittingOrder), true);
        assert.equal(await page.evaluate(() => resetKioskSession()), false);
        heldCash.shift()();
        await page.locator('.kiosk-confirmation').waitFor();
        for (let i = 0; !heldPrint.length && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 10));
        assert.equal(heldPrint.length, 1);
        await page.clock.runFor(20000);
        assert.equal(await screen(page), 'confirmation');
        assert.equal(await page.locator('[data-kiosk-action="new-order"]').isDisabled(), true);
        assert.equal(await page.evaluate(() => resetKioskSession()), false);
        assert.match(await page.locator('.kiosk-receipt').innerText(), /94.50/);
        heldPrint.shift()();
        await page.waitForFunction(() => state.kiosk.printingReceiptOrderIds.size === 0);
        await page.clock.runFor(7000);
        assert.equal(await screen(page), 'welcome');
        assert.equal(orders.size, count + 1);
        assert.equal(await page.evaluate(() => state.confirmation), null);
        assert.ok(!(await page.locator('body').innerText()).includes('Private Guest'));
      } finally { cashMode = 'ok'; printMode = 'ok'; heldCash.splice(0).forEach(release => release()); heldPrint.splice(0).forEach(release => release()); await page.close(); }
    });
    await t.test('lost order response is protected and retry reuses the exact payload/key', async () => {
      const page = await open(); cashMode = 'lost';
      try {
        await review(page); await clock(page);
        const count = orders.size;
        await page.locator('[data-kiosk-action="place-order"]').click();
        await page.getByRole('button', { name: 'Check order', exact: true }).waitFor();
        const first = requests.filter(row => row.path === '/api/payments/cash-order').at(-1).body;
        await page.clock.runFor(180000);
        assert.equal(await screen(page), 'review');
        assert.equal(await page.evaluate(() => resetKioskSession()), false);
        cashMode = 'ok';
        await page.getByRole('button', { name: 'Check order', exact: true }).click();
        await page.locator('.kiosk-confirmation').waitFor();
        assert.deepEqual(requests.filter(row => row.path === '/api/payments/cash-order').at(-1).body, first);
        assert.equal(orders.size, count + 1);
      } finally { cashMode = 'ok'; await page.close(); }
    });
    await t.test('repeated idle cycles keep timers/listeners bounded and animation advances without network work', async () => {
      const page = await open();
      try {
        const animation = await page.locator('.kiosk-attract-hand').evaluate(node => getComputedStyle(node).transform);
        await page.waitForTimeout(400);
        assert.notEqual(await page.locator('.kiosk-attract-hand').evaluate(node => getComputedStyle(node).transform), animation);
        await clock(page);
        for (let i = 0; i < 20; i++) {
          await page.evaluate(() => { bindKioskEvents(); startKioskMode(); setKioskScreen('menu'); });
          await page.clock.runFor(61000);
          assert.equal(await screen(page), 'welcome');
          assert.deepEqual(await page.evaluate(() => window.restaurantKioskTimerDebug), { menuRefreshTimerCount: 1, settingsRefreshTimerCount: 1,
            idleTimerCount: 0, idleGraceTimerCount: 0, idleCountdownCount: 0, confirmationIntervalCount: 0, confirmationResetTimerCount: 0 });
        }
        assert.equal(await page.locator('.kiosk-attract').count(), 1);
        assert.equal(await page.evaluate(() => document.getAnimations().length), 2);
      } finally { await page.close(); }
    });
  } finally {
    await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
});
