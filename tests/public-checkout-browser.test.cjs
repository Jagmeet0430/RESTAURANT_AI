const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { chromium, webkit } = require('playwright');
const postcss = require('postcss');

const root = path.resolve(__dirname, '..');
const frontend = path.join(root, 'frontend');
const output = path.join(root, 'temp/public-checkout-validation', process.env.PUBLIC_TEST_BROWSER || 'chromium');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };

test('public checkout browser regressions (local API fixtures only)', { timeout: 120000 }, async t => {
  await fs.mkdir(output, { recursive: true });
  postcss.parse(await fs.readFile(path.join(frontend, 'styles.css'), 'utf8'));
  let mode = 'success', submissions = 0, quoteFails = false;
  const orders = new Map(), calls = [];
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        let raw = ''; for await (const chunk of req) raw += chunk;
        const body = raw ? JSON.parse(raw) : {};
        calls.push({ path: url.pathname, body });
        let data = {}, status = 200;
        if (url.pathname === '/api/menu') data = [{ id: 1, name: 'Cheese Corn Roll', category: 'Rolls', price: 90, is_available: true }];
        if (url.pathname === '/api/settings/public') data = { restaurantName: 'Mahesh sweets and Bakers',
          public_order_otp_required: true, public_order_pricing: { gst_rate: .05, packing_charge: 0 } };
        if (url.pathname === '/api/payments/methods') data = { online_enabled: false };
        if (url.pathname.startsWith('/api/customers/phone/')) data = { id: 1, name: 'Fixture', phone: '+919876543210' };
        if (url.pathname === '/api/payments/quote') {
          data = { subtotal: 90, tax: 4.5, delivery_charge: 0, total: 94.5 };
          if (quoteFails) { status = 503; data = null; }
        }
        if (url.pathname === '/api/customers/otp/send') data = { phone: body.phone, resend_after_seconds: 30 };
        if (url.pathname === '/api/customers/otp/verify') data = { phone: body.phone, verification_token: 'fixture-token' };
        if (url.pathname === '/api/customers/orders') { status = 401; data = null; }
        if (url.pathname.startsWith('/api/orders/track/')) {
          if (url.pathname.endsWith('/events')) { res.writeHead(503); res.end(); return; }
          if (url.pathname.endsWith('/' + 'a'.repeat(64))) data = { orderNumber: 'ORD-FIXTURE', customerFirstName: 'Fixture',
            maskedPhone: '******3210', orderType: 'pickup', paymentStatus: 'Pending',
            timeline: ['confirmed','accepted','preparing','ready','completed'], currentStatus: 'preparing', items: [] };
          else { status = 404; data = null; }
        }
        if (url.pathname === '/api/payments/order-outcome') data = { order: orders.get(body.idempotency_key) || null };
        if (url.pathname === '/api/payments/cash-order') {
          submissions++;
          if (mode === 'reject') { status = 409; data = null; }
          else {
            if (!orders.has(body.idempotency_key)) orders.set(body.idempotency_key, { id: orders.size + 1,
              order_number: `ORD-FIXTURE-${orders.size + 1}`, token_number: 101, tracking_token: 'a'.repeat(64),
              subtotal: 90, tax: 4.5, delivery_charge: 0, total_amount: 94.5, payment_status: 'Pending' });
            data = { order: orders.get(body.idempotency_key) };
            if (mode === 'lost') { res.destroy(); return; }
            await new Promise(resolve => setTimeout(resolve, 80));
          }
        }
        if (url.pathname === '/api/hanging-body') {
          res.writeHead(200, { 'Content-Type': 'application/json' }); res.write('{'); return;
        }
        res.writeHead(status, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: status < 400, data, message: status >= 400 ? 'Fixture failure' : 'OK' }));
      }
      let relative = decodeURIComponent(url.pathname).replace(/^\//, '');
      if (!relative || relative === 'customer' || relative.includes('track-order/')) relative = 'index.html';
      else relative = relative.replace(/^customer\//, '');
      const file = path.resolve(frontend, relative);
      if (!file.startsWith(frontend + path.sep)) { res.writeHead(403); return res.end(); }
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
      res.end(await fs.readFile(file));
    } catch { res.destroy(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  const open = async (width = 390, height = 844) => {
    const page = await browser.newPage({ viewport: { width, height } });
    page.setDefaultTimeout(5000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.addInitScript(base => { window.RESTAURANTAI_API_BASE_URL = base; }, origin + '/api');
    await page.goto(origin + '/customer', { waitUntil: 'networkidle' });
    await page.locator('[data-menu-add="1"]').click();
    assert.deepEqual(errors, []);
    return page;
  };
  const prepare = async page => {
    await page.evaluate(() => {
      elements.customerName.value = 'Fixture'; elements.customerPhone.value = '9876543210';
      Object.assign(state.phoneVerification, { status: 'verified', phone: '+919876543210', token: 'fixture-token' });
      state.checkoutStep = 'payment'; setMobileCartOpen(true);
    });
  };
  try {
    browser = process.env.PUBLIC_TEST_BROWSER === 'webkit'
      ? await webkit.launch({ headless: true })
      : await chromium.launch({ channel: 'msedge', headless: true });
    for (const [width, height] of [[320, 740], [375, 812], [390, 844], [430, 932]]) {
      await t.test(`${width}x${height}: safe sheet, tappable controls, AI hidden, clear preserves verification`, async () => {
        const page = await open(width, height);
        try {
          await page.locator('#chatToggle').click();
          await page.locator('#mobileCartButton').click();
          assert.equal(await page.locator('#chatPanel').isVisible(), false);
          assert.equal(await page.locator('#chatToggle').isVisible(), false);
          assert.equal(await page.evaluate(() => getComputedStyle(document.body).position), 'fixed');
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          await page.screenshot({ path: path.join(output, `cart-${width}.png`) });
          await page.locator('[data-mobile-action="order-type"]').click();
          await page.locator('[data-mobile-action="phone"]').click();
          await page.locator('[data-mobile-field="phone"]').fill('9876543210');
          await page.locator('#mobileCartSheet [data-otp-send]').click();
          await page.locator('#mobileCartSheet [data-otp-input]').fill('123456');
          await page.locator('#mobileCartSheet [data-otp-verify]').click();
          await page.locator('[data-mobile-field="name"]').fill('Fixture');
          await page.locator('[data-mobile-action="payment"]').click();
          await page.waitForFunction(() => Boolean(state.publicQuote));
          assert.match(await page.locator('.mobile-totals').innerText(), /94\.50/);
          assert.doesNotMatch(await page.locator('.mobile-totals').innerText(), /Packing/);
          const button = await page.locator('[data-mobile-action="place-order"]').boundingBox();
          assert.ok(button.height >= 44 && button.x >= 0 && button.x + button.width <= width && button.y + button.height <= height);
          await page.screenshot({ path: path.join(output, `payment-${width}.png`) });
          await page.goBack();
          await page.waitForFunction(() => !state.mobileCartOpen);
          assert.equal(await page.locator('#chatToggle').isVisible(), true);
          await page.evaluate(() => { state.checkoutStep = 'cart'; setMobileCartOpen(true); });
          page.once('dialog', dialog => dialog.dismiss());
          await page.locator('[data-mobile-action="clear-cart"]').click();
          assert.equal(await page.evaluate(() => state.cart.length), 1);
          page.once('dialog', dialog => dialog.accept());
          await page.locator('[data-mobile-action="clear-cart"]').click();
          assert.equal(await page.evaluate(() => state.cart.length), 0);
          assert.equal(await page.evaluate(() => state.phoneVerification.token), 'fixture-token');
          assert.equal(await page.locator('#customerName').inputValue(), 'Fixture');
        } finally { await page.close(); }
      });
    }
    await t.test('timeouts include response body; a later request still works', async () => {
      const page = await open();
      try {
        const error = await page.evaluate(() => requestJson('/hanging-body', { timeoutMs: 50 }).then(() => null, error => error.code || error.name));
        assert.ok(['REQUEST_TIMEOUT', 'AbortError'].includes(error));
        assert.equal(await page.evaluate(() => requestJson('/payments/methods').then(data => data.online_enabled)), false);
      } finally { await page.close(); }
    });
    await t.test('definite rejection restores checkout and cart; double click creates one order', async () => {
      const page = await open();
      try {
        await prepare(page); mode = 'reject'; const before = submissions;
        await page.locator('[data-mobile-action="place-order"]').click();
        await page.waitForFunction(() => !state.isSubmittingOrder);
        assert.equal(await page.evaluate(() => state.cart.length), 1);
        assert.equal(await page.locator('[data-mobile-action="place-order"]').isEnabled(), true);
        assert.equal(await page.evaluate(() => state.pendingPublicOrder), null);
        assert.equal(submissions, before + 1);
        mode = 'success';
        await page.evaluate(() => Promise.all([placeOrder(), placeOrder()]));
        assert.equal(submissions, before + 2);
        assert.equal(await page.evaluate(() => state.confirmation.totals.total), 94.5);
        assert.equal(await page.evaluate(() => state.cart.length), 0);
        assert.equal(await page.locator('#mobileCartSheet .order-success-card').isVisible(), true);
        assert.match(await page.locator('#mobileCartSheet .mobile-totals').innerText(), /94\.50/);
        assert.equal(await page.locator('#mobileCartSheet a').getAttribute('href'), origin + '/customer/track-order/' + 'a'.repeat(64));
        await page.locator('[data-mobile-action="close"]').click();
        assert.equal(await page.locator('#chatToggle').isVisible(), true);
      } finally { await page.close(); }
    });
    await t.test('lost saved-order response survives reload and recovers without resubmission', async () => {
      const page = await open();
      try {
        mode = 'lost'; const before = orders.size;
        await prepare(page);
        await page.evaluate(() => placeOrder());
        const attemptsAfterDisconnect = submissions;
        assert.equal(await page.evaluate(() => state.cart.length), 1);
        assert.ok(await page.evaluate(() => Boolean(state.pendingPublicOrder)));
        await page.evaluate(() => changeQty(1, 1));
        assert.equal(await page.evaluate(() => state.cart[0].qty), 1);
        await page.reload({ waitUntil: 'networkidle' });
        await page.locator('#mobileCartButton').click();
        assert.equal(await page.locator('[data-mobile-action="place-order"]').innerText(), 'Check order');
        await page.locator('[data-mobile-action="place-order"]').click();
        await page.waitForFunction(() => Boolean(state.confirmation));
        assert.equal(submissions, attemptsAfterDisconnect, 'checking must not submit again');
        assert.equal(orders.size, before + 1, 'transport retries must not create a duplicate');
        assert.equal(await page.evaluate(() => state.confirmation.totals.total), 94.5);
        assert.equal(await page.evaluate(() => sessionStorage.getItem('restaurantai_pending_public_order')), null);
      } finally { mode = 'success'; await page.close(); }
    });
    await t.test('quote failures clear loading; expired tracking session requires verification again', async () => {
      const page = await open();
      try {
        await prepare(page); quoteFails = true;
        await page.evaluate(() => placeOrder());
        assert.equal(await page.locator('[data-mobile-action="place-order"]').isEnabled(), true);
        assert.equal(await page.evaluate(() => state.cart.length), 1);
        await page.evaluate(async () => {
          Object.assign(state.trackOrders, { token: 'expired-fixture', phone: '+919876543210' });
          await loadVerifiedCustomerOrders();
        });
        assert.equal(await page.evaluate(() => state.trackOrders.token), '');
        assert.equal(await page.evaluate(() => state.trackOrders.orders.length), 0);
      } finally { quoteFails = false; await page.close(); }
    });
    await t.test('deep tracking links load assets; valid status renders and invalid link offers retry', async () => {
      const page = await open();
      try {
        for (const prefix of ['', '/customer']) {
          await page.goto(origin + prefix + '/track-order/' + 'a'.repeat(64), { waitUntil: 'networkidle' });
          assert.equal(await page.locator('#trackingTitle').innerText(), 'Order #ORD-FIXTURE');
          assert.equal(await page.locator('.tracking-step.is-current').innerText(), 'Preparing');
          assert.ok(await page.locator('.tracking-card').evaluate(element => getComputedStyle(element).padding !== '0px'));
        }
        await page.goto(origin + '/track-order/' + 'b'.repeat(64), { waitUntil: 'networkidle' });
        assert.equal(await page.locator('#trackingTitle').innerText(), 'Tracking unavailable');
        assert.equal(await page.locator('#trackingRetry').isVisible(), true);
        assert.ok(!calls.some(call => call.path === '/api/orders/track/' + 'b'.repeat(64) + '/events'));
      } finally { await page.close(); }
    });
    assert.ok(calls.some(call => call.path === '/api/customers/otp/send' && call.body.purpose === 'checkout'));
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
