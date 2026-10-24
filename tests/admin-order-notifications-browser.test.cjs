// Run after: npm --prefix admin run build. No backend or database is used.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

test('Admin notification provider and popup (isolated APIs)', async t => {
  const dist = path.resolve(__dirname, '../admin/dist');
  const output = path.resolve(__dirname, '../temp/admin-notification-validation');
  await fs.mkdir(output, { recursive: true });
  const requests = [], errors = [];
  const orders = [1, 2, 3, 90].map(id => ({ id, order_number: `FIXTURE-${id}`, token_number: `T${id}`,
    table_number: id === 3 ? '7' : null, order_source: ({ 1: 'kiosk', 2: 'website', 3: 'table_qr' })[id] || 'kiosk',
    order_type: 'dine_in', status: 'Confirmed', total_amount: '210.50', payment_status: 'Pending',
    payment_method: 'Pay at Counter', customer_name: 'PRIVATE CUSTOMER', customer_phone: '9999999999',
    created_at: new Date().toISOString(), items: [{ name: 'Fixture meal', quantity: 2, unit_price: 100 }] }));
  let pending = [], failure = 0, holdNextPoll = false, releasePoll;
  let policy = { orderNotificationPopup: 'true', orderNotificationSound: 'true', orderNotificationVoice: 'false',
    orderNotificationLanguage: 'en', orderNotificationRepeatSeconds: '0', orderNotificationAutoNavigate: 'false' };
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const body = chunks.length ? JSON.parse(Buffer.concat(chunks)) : {};
        requests.push({ path: url.pathname, method: req.method, body, time: Date.now(), auth: req.headers.authorization });
        let data = [], status = 200;
        if (url.pathname === '/api/auth/profile') data = { id: 1, name: 'Fixture Admin', role: 'admin' };
        else if (url.pathname === '/api/admin/orders/notifications') {
          status = failure || 200;
          data = { notifications: pending.map(id => {
            const order = orders.find(o => o.id === id);
            return { order_id: id, created_at: order.created_at, status: order.status, item_count: order.items.length,
              grand_total: order.total_amount, payload: { order_number: order.order_number, order_source: order.order_source,
                order_type: order.order_type, token_number: order.token_number, table_number: order.table_number } };
          }), has_more: false, next_cursor: null };
          if (holdNextPoll) { holdNextPoll = false; await new Promise(resolve => { releasePoll = resolve; }); }
        } else if (/\/notifications\/\d+\/ack$/.test(url.pathname)) {
          const id = Number(url.pathname.split('/').at(-2));
          await new Promise(resolve => setTimeout(resolve, 100));
          pending = pending.filter(value => value !== id); data = { order_id: id, acknowledged_at: new Date().toISOString() };
        } else if (/\/admin\/orders\/\d+\/status$/.test(url.pathname)) {
          const order = orders.find(o => o.id === Number(url.pathname.split('/').at(-2)));
          await new Promise(resolve => setTimeout(resolve, 100));
          order.status = body.status; data = order;
        } else if (url.pathname === '/api/orders') data = orders;
        else if (/^\/api\/orders\/\d+$/.test(url.pathname)) data = orders.find(o => o.id === Number(url.pathname.split('/').at(-1)));
        else if (url.pathname === '/api/settings/order-notifications') data = policy;
        else if (url.pathname === '/api/settings') {
          if (req.method === 'PUT') policy = { ...policy, ...Object.fromEntries(Object.entries(body).filter(([key]) => key.startsWith('orderNotification'))) };
          data = { restaurantName: 'Fixture Restaurant', ...policy };
        }
        else if (url.pathname === '/api/receipt-printer/settings') data = { config: { enabled: false, paperWidth: '58mm', copies: 1 }, printers: [], supported: false, host: 'Fixture' };
        else if (url.pathname.includes('/settings')) data = {};
        res.writeHead(status, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: status === 200, data, message: status === 200 ? undefined : 'Fixture unavailable' }));
      }
      const file = path.resolve(dist, url.pathname.startsWith('/admin/assets/') ? url.pathname.slice(7) : 'index.html');
      if (!file.startsWith(dist + path.sep)) { res.writeHead(403); return res.end(); }
      res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[path.extname(file)] || 'text/plain' });
      res.end(await fs.readFile(file));
    } catch (error) { errors.push(error.message); res.writeHead(500); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser, context, page;
  const calls = route => requests.filter(r => r.path === route);
  const mutations = () => requests.filter(r => ['POST', 'PATCH'].includes(r.method));
  const popup = p => p.getByRole('region', { name: 'New order notification' });
  const refresh = p => p.evaluate(() => window.dispatchEvent(new Event('online')));
  const waitFor = async (fn, attempts = 100) => {
    for (let i = 0; i < attempts; i++) { if (await fn()) return; await new Promise(resolve => setTimeout(resolve, 100)); }
    assert.fail('Condition did not become true');
  };
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await context.addInitScript(expectedOrigin => {
      if (location.origin !== expectedOrigin) return;
      if (!sessionStorage.getItem('fixtureStarted')) { localStorage.setItem('authToken', 'fixture'); sessionStorage.setItem('fixtureStarted', '1'); }
      Object.defineProperty(document, 'hidden', { get: () => Boolean(window.fixtureHidden) });
      window.mediaLog = { tones: 0, speech: [], active: 0, overlap: false, notifications: [] };
      window.voiceLanguages = ['en-IN', 'hi-IN'];
      class AudioFixture {
        state = 'suspended'; currentTime = 0; destination = {};
        resume() { this.state = 'running'; return Promise.resolve(); }
        close() { this.state = 'closed'; return Promise.resolve(); }
        createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
        createOscillator() { return { frequency: { setValueAtTime() {} }, connect() {}, disconnect() {}, start() { window.mediaLog.tones++; }, stop() {} }; }
      }
      window.AudioContext = AudioFixture;
      let timer, current;
      const synthesis = {
        speaking: false, resume() {},
        getVoices: () => window.voiceLanguages.map(lang => ({ lang, localService: true })),
        speak(utterance) {
          if (window.blockSpeech) throw new Error('Fixture speech blocked');
          window.mediaLog.overlap ||= this.speaking;
          this.speaking = true; current = utterance;
          window.mediaLog.speech.push({ text: utterance.text, lang: utterance.lang, volume: utterance.volume });
          timer = setTimeout(() => { this.speaking = false; current = null; utterance.onend?.(); }, window.speechDelay || 100);
        },
        cancel() { clearTimeout(timer); this.speaking = false; const old = current; current = null; old?.onerror?.(); },
      };
      Object.defineProperty(window, 'speechSynthesis', { value: synthesis, configurable: true });
      window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
      window.Notification = class {
        static permission = 'default';
        static async requestPermission() { this.permission = 'granted'; return 'granted'; }
        constructor(title, options) { this.title = title; this.options = options; window.mediaLog.notifications.push(this); }
        close() { this.closed = true; }
      };
    }, origin);
    context.on('page', p => { p.on('pageerror', error => errors.push(error.message)); p.setDefaultTimeout(10000); });
    page = await context.newPage();

    await t.test('historical orders do not alert; pending IDs deduplicate and contain no PII', async () => {
      await page.goto(origin + '/admin/orders');
      await waitFor(() => calls('/api/admin/orders/notifications').length > 0);
      assert.equal(await popup(page).count(), 0);
      pending = [1, 1, 2, 3];
      await refresh(page);
      await popup(page).getByText('3 pending', { exact: true }).waitFor();
      const text = await popup(page).innerText();
      for (const value of ['FIXTURE-1', 'Kiosk', 'Dine-in', '210.50', 'Confirmed', 'T1']) assert.ok(text.includes(value), value);
      assert.ok(!text.includes('PRIVATE CUSTOMER') && !text.includes('9999999999'));
      const saved = await page.evaluate(() => localStorage.getItem('restaurantai-order-alerts:v1:1:snapshot'));
      assert.ok(!saved.includes('PRIVATE CUSTOMER') && !saved.includes('9999999999'));
      assert.equal(JSON.parse(saved).queue.length, 3);
      await page.locator('aside [aria-label="3 pending orders"]').waitFor();
    });

    await t.test('popup persists on Admin routes, fits desktop, and View Order opens the correct record', async () => {
      for (const route of ['/dashboard', '/menu', '/inventory', '/bills', '/customers', '/settings', '/orders']) {
        await page.locator(`aside a[href="/admin${route}"]`).click();
        await popup(page).getByText('FIXTURE-1', { exact: true }).waitFor();
        assert.equal(await popup(page).count(), 1);
      }
      for (const width of [1366, 1920]) {
        await page.setViewportSize({ width, height: width === 1366 ? 768 : 1080 });
        const bounds = await popup(page).boundingBox();
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.y >= 0);
        const controls = await popup(page).locator('button').evaluateAll(buttons => buttons.map(b => {
          const box = b.getBoundingClientRect();
          return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, clipped: b.scrollWidth > b.clientWidth };
        }));
        for (const [index, box] of controls.entries()) {
          assert.equal(box.clipped, false, 'button label must fit');
          assert.ok(box.left >= bounds.x && box.right <= bounds.x + bounds.width);
          for (const other of controls.slice(index + 1)) assert.ok(box.right <= other.left || other.right <= box.left || box.bottom <= other.top || other.bottom <= box.top, 'buttons must not overlap');
        }
        await popup(page).screenshot({ path: path.join(output, `popup-${width}.png`) });
      }
      await popup(page).getByRole('button', { name: 'View Order', exact: true }).click();
      assert.ok(page.url().includes('order=1'));
      await page.getByRole('dialog').getByText(/FIXTURE-1/).waitFor();
      await page.keyboard.press('Escape');
    });

    await t.test('local snooze/dismiss survive refresh; ack and accept are separate and double-click guarded', async () => {
      const before = mutations().length;
      await popup(page).getByRole('button', { name: 'Snooze 5 min' }).click();
      await popup(page).getByText('FIXTURE-2', { exact: true }).waitFor();
      await popup(page).getByRole('button', { name: 'Dismiss', exact: true }).click();
      await popup(page).getByText('FIXTURE-3', { exact: true }).waitFor();
      await page.reload();
      await popup(page).getByText('FIXTURE-3', { exact: true }).waitFor();
      assert.equal(mutations().length, before);
      await popup(page).getByRole('button', { name: 'Acknowledge', exact: true }).evaluate(b => { b.click(); b.click(); });
      await waitFor(async () => !(await popup(page).count()));
      assert.equal(calls('/api/admin/orders/notifications/3/ack').length, 1);
      assert.equal(orders[2].status, 'Confirmed');
      await page.getByRole('button', { name: 'Pending orders (2)', exact: true }).click();
      await popup(page).getByText('FIXTURE-1', { exact: true }).waitFor();
      await popup(page).getByRole('button', { name: 'Accept', exact: true }).evaluate(b => { b.click(); b.click(); });
      await popup(page).getByText('FIXTURE-2', { exact: true }).waitFor();
      assert.equal(calls('/api/admin/orders/1/status').length, 1);
      assert.deepEqual(calls('/api/admin/orders/1/status')[0].body, { status: 'Accepted' });
      assert.equal(calls('/api/admin/orders/1/status')[0].auth, 'Bearer fixture');
      assert.equal(calls('/api/admin/orders/notifications/1/ack').length, 0);
      orders[1].status = 'Cancelled';
      await refresh(page);
      await waitFor(async () => !(await popup(page).count()));
      assert.equal(calls('/api/admin/orders/notifications/2/ack').length, 0);
    });

    await t.test('one cross-tab owner; sanitized follower snapshot; handoff after close', async () => {
      orders[1].status = 'Confirmed'; pending = [2];
      await refresh(page);
      await popup(page).waitFor();
      const follower = await context.newPage();
      await follower.goto(origin + '/admin/menu');
      await follower.locator('aside [aria-label="1 pending orders"]').waitFor();
      assert.equal(await popup(follower).count(), 0);
      const before = calls('/api/admin/orders/notifications').length;
      await new Promise(resolve => setTimeout(resolve, 3600));
      assert.ok(calls('/api/admin/orders/notifications').length - before <= 2, 'followers must not duplicate pending polling');
      await page.close(); page = follower;
      await popup(page).getByText('FIXTURE-2', { exact: true }).waitFor();
    });

    await t.test('acknowledge wins over an older in-flight poll; hidden cadence is 15 seconds', async () => {
      holdNextPoll = true;
      await refresh(page);
      await waitFor(() => Boolean(releasePoll));
      await popup(page).getByRole('button', { name: 'Acknowledge', exact: true }).click();
      await waitFor(() => !pending.includes(2));
      const release = releasePoll; releasePoll = null; release();
      await waitFor(async () => !(await popup(page).count()));
      await new Promise(resolve => setTimeout(resolve, 500));
      assert.equal(await popup(page).count(), 0, 'stale pending result cannot restore acknowledged order');
      assert.equal(orders[1].status, 'Confirmed');
      await page.evaluate(() => { window.fixtureHidden = true; document.dispatchEvent(new Event('visibilitychange')); });
      await new Promise(resolve => setTimeout(resolve, 300));
      const before = calls('/api/admin/orders/notifications').length;
      await new Promise(resolve => setTimeout(resolve, 4000));
      assert.equal(calls('/api/admin/orders/notifications').length, before, 'no 3s poll while hidden');
      await waitFor(() => calls('/api/admin/orders/notifications').length > before, 160);
      // The deadline is measured from the server request, not test-runner scheduling.
      const last = calls('/api/admin/orders/notifications').at(-1);
      assert.ok(last.time - calls('/api/admin/orders/notifications')[before - 1].time >= 14500);
      pending = [2];
      await page.evaluate(() => { window.fixtureHidden = false; document.dispatchEvent(new Event('visibilitychange')); });
      await popup(page).waitFor();
    });

    await t.test('notification Settings save policy only; gesture unlock, once-only speech and local volume persist', async () => {
      await page.locator('aside a[href="/admin/settings"]').click();
      const section = page.locator('#order-notification-settings');
      await section.getByLabel('Enable voice', { exact: true }).check();
      await section.getByRole('slider').press('End');
      await section.getByRole('slider').press('ArrowLeft');
      await section.getByRole('button', { name: 'Save notification settings' }).click();
      await section.getByText('Order notification settings saved.').waitFor();
      assert.equal(policy.orderNotificationVoice, 'true');
      const saved = calls('/api/settings').filter(r => r.method === 'PUT').at(-1).body;
      assert.ok(Object.keys(saved).every(key => key.startsWith('orderNotification')));
      assert.ok(!('volume' in saved) && !('audioUnlocked' in saved) && !('desktopPermission' in saved));
      assert.equal(await page.evaluate(() => window.mediaLog.speech.length), 0, 'no audio before gesture');
      await section.getByRole('button', { name: 'Test Sound', exact: true }).click();
      await waitFor(() => page.evaluate(() => window.mediaLog.speech.some(s => s.text.includes('FIXTURE-2'))));
      const spoken = await page.evaluate(() => window.mediaLog.speech.find(s => s.text.includes('FIXTURE-2')));
      assert.equal(spoken.text, 'New customer order received. Order number FIXTURE-2. Please check the order.');
      assert.equal(spoken.volume, 0.95);
      assert.ok(await page.evaluate(() => window.mediaLog.tones > 0));
      await refresh(page);
      await new Promise(resolve => setTimeout(resolve, 300));
      assert.equal(await page.evaluate(() => window.mediaLog.speech.filter(s => s.text.includes('FIXTURE-2')).length), 1);
      await page.reload();
      await section.getByRole('button', { name: 'Enable Sound', exact: true }).click();
      await refresh(page);
      await new Promise(resolve => setTimeout(resolve, 400));
      assert.equal(await page.evaluate(() => window.mediaLog.speech.length), 0, 'refresh must not replay an announced ID');
      assert.equal(await section.getByRole('slider').getAttribute('aria-valuenow'), '95');
      assert.equal(calls('/api/orders/2').length, 0, 'pending metadata must eliminate per-order enrichment calls');
      await section.screenshot({ path: path.join(output, 'order-notification-settings.png') });
    });

    await t.test('reminders only for pending non-snoozed orders; Hindi, English fallback and blocked speech feedback', async () => {
      const section = page.locator('#order-notification-settings');
      const select = async (label, option) => { await section.getByRole('combobox', { name: label }).click(); await page.getByRole('option', { name: option, exact: true }).click(); };
      await select('Repeat reminder', '30 seconds');
      await section.getByRole('button', { name: 'Save notification settings' }).click();
      await section.getByText('Order notification settings saved.').waitFor();
      const age = () => page.evaluate(() => {
        const key = 'restaurantai-order-alerts:v1:1:announced', value = JSON.parse(localStorage.getItem(key));
        value['2'].audio = Date.now() - 60000; localStorage.setItem(key, JSON.stringify(value));
      });
      await age(); await refresh(page);
      await waitFor(() => page.evaluate(() => window.mediaLog.speech.some(s => s.text.includes('FIXTURE-2'))));
      await popup(page).getByRole('button', { name: 'Snooze 5 min' }).click();
      const before = await page.evaluate(() => window.mediaLog.speech.length);
      await age(); await refresh(page); await new Promise(resolve => setTimeout(resolve, 400));
      assert.equal(await page.evaluate(() => window.mediaLog.speech.length), before);
      orders[1].status = 'Accepted'; await refresh(page); await new Promise(resolve => setTimeout(resolve, 300));
      assert.equal(await popup(page).count(), 0);
      await select('Announcement language', 'Hindi'); await select('Repeat reminder', 'Off');
      await section.getByRole('button', { name: 'Save notification settings' }).click();
      await section.getByText('Order notification settings saved.').waitFor();
      await section.getByRole('button', { name: 'Test Voice', exact: true }).click();
      await waitFor(() => page.evaluate(() => window.mediaLog.speech.some(s => s.lang === 'hi-IN')));
      assert.match((await page.evaluate(() => window.mediaLog.speech.at(-1).text)), /123/);
      await new Promise(resolve => setTimeout(resolve, 150));
      await page.evaluate(() => { window.voiceLanguages = ['en-IN']; });
      await section.getByRole('button', { name: 'Test Voice', exact: true }).click();
      await waitFor(() => page.evaluate(() => window.mediaLog.speech.at(-1)?.text === 'New customer order received. Order number 123. Please check the order.'));
      await new Promise(resolve => setTimeout(resolve, 150));
      await page.evaluate(() => { window.voiceLanguages = []; });
      await section.getByRole('button', { name: 'Test Voice', exact: true }).click();
      await section.getByText('No local speech voice is available. Visual alerts remain active.').waitFor();
      await page.evaluate(() => { window.voiceLanguages = ['en-IN']; window.blockSpeech = true; });
      await section.getByRole('button', { name: 'Test Voice', exact: true }).click();
      await section.getByText('Speech was blocked or interrupted. Visual alerts remain active.').waitFor();
      await page.evaluate(() => { window.blockSpeech = false; });
    });

    await t.test('desktop notification opens the right order; chatbot and alerts never speak over each other', async () => {
      const section = page.locator('#order-notification-settings');
      await section.getByRole('button', { name: 'Enable desktop notifications' }).click();
      await section.getByText('Desktop permission: granted').waitFor();
      orders.push({ ...orders[0], id: 4, order_number: 'FIXTURE-4', status: 'Confirmed' }); pending = [4];
      await refresh(page);
      await waitFor(() => page.evaluate(() => window.mediaLog.notifications.some(n => n.options.body === 'Order FIXTURE-4')));
      await page.evaluate(() => window.mediaLog.notifications.find(n => n.options.body === 'Order FIXTURE-4').onclick());
      await page.getByRole('dialog').getByText(/FIXTURE-4/).waitFor();
      assert.ok(page.url().includes('order=4'));
      await page.keyboard.press('Escape');
      await page.locator('aside a[href="/admin/dashboard"]').click();
      await page.getByRole('button', { name: 'Open assistant', exact: true }).click();
      await page.evaluate(() => { window.speechDelay = 1000; });
      await page.getByTitle('Speak answer', { exact: true }).first().click();
      await waitFor(() => page.evaluate(() => window.speechSynthesis.speaking));
      orders.push({ ...orders[0], id: 5, order_number: 'FIXTURE-5', status: 'Confirmed' }); pending = [5, 4];
      await refresh(page);
      await waitFor(() => page.evaluate(() => window.mediaLog.speech.some(s => s.text.includes('FIXTURE-5'))));
      assert.equal(await page.evaluate(() => window.mediaLog.overlap), false);
      assert.ok((await page.evaluate(() => window.mediaLog.speech.map(s => s.text).join(' '))).includes('RestaurantAI Assistant'));
      assert.doesNotMatch(await page.evaluate(() => JSON.stringify(window.mediaLog)), /PRIVATE CUSTOMER|9999999999/);
      assert.ok(page.url().endsWith('/dashboard'), 'auto-navigation defaults OFF');
      await page.locator('aside a[href="/admin/menu"]').click();
    });

    await t.test('popup can be disabled; auto-navigation is opt-in and never interrupts Settings', async () => {
      await page.locator('aside a[href="/admin/settings"]').click();
      const section = page.locator('#order-notification-settings');
      await section.getByLabel('Enable popup', { exact: true }).uncheck();
      await section.getByLabel('Auto-navigate from idle Dashboard', { exact: true }).check();
      await section.getByRole('button', { name: 'Save notification settings' }).click();
      await section.getByText('Order notification settings saved.').waitFor();
      await waitFor(async () => !(await popup(page).count()));
      assert.equal(policy.orderNotificationAutoNavigate, 'true');
      orders.push({ ...orders[0], id: 6, order_number: 'FIXTURE-6', status: 'Confirmed' }); pending = [6, 5, 4];
      await section.getByRole('slider').focus();
      await refresh(page); await new Promise(resolve => setTimeout(resolve, 300));
      assert.ok(page.url().endsWith('/settings'), 'never leave a settings form automatically');
      await section.screenshot({ path: path.join(output, 'order-notification-settings.png') });
      await page.locator('aside a[href="/admin/dashboard"]').click();
      await waitFor(() => page.url().includes('/orders?order='));
      await page.getByRole('dialog').waitFor();
      await page.keyboard.press('Escape');
      await page.locator('aside a[href="/admin/settings"]').click();
      await section.getByLabel('Enable popup', { exact: true }).check();
      await section.getByLabel('Auto-navigate from idle Dashboard', { exact: true }).uncheck();
      await section.getByRole('button', { name: 'Save notification settings' }).click();
      await section.getByText('Order notification settings saved.').waitFor();
      await page.locator('aside a[href="/admin/menu"]').click();
    });

    await t.test('acknowledged announcements cannot replay after reconnect or refresh; missing speech stays visual', async () => {
      await page.evaluate(() => { window.speechDelay = 100; });
      orders.push({ ...orders[0], id: 7, order_number: 'FIXTURE-7', status: 'Confirmed' }); pending = [7];
      await refresh(page);
      await popup(page).getByText('FIXTURE-7', { exact: true }).waitFor();
      await waitFor(() => page.evaluate(() => window.mediaLog.speech.some(s => s.text.includes('FIXTURE-7'))));
      await popup(page).getByRole('button', { name: 'Acknowledge', exact: true }).click();
      await waitFor(async () => !(await popup(page).count()));
      assert.equal(orders.find(o => o.id === 7).status, 'Confirmed', 'acknowledgement is not acceptance');
      await refresh(page);
      await new Promise(resolve => setTimeout(resolve, 400));
      assert.equal(await page.evaluate(() => window.mediaLog.speech.filter(s => s.text.includes('FIXTURE-7')).length), 1);
      await page.reload();
      await page.getByRole('button', { name: 'Enable Sound', exact: true }).click();
      await refresh(page);
      await new Promise(resolve => setTimeout(resolve, 400));
      assert.equal(await popup(page).count(), 0);
      assert.equal(await page.evaluate(() => window.mediaLog.speech.length), 0);
      await page.evaluate(() => { Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true }); });
      orders.push({ ...orders[0], id: 8, order_number: 'FIXTURE-8', status: 'Confirmed' }); pending = [8];
      await refresh(page);
      await popup(page).getByText('FIXTURE-8', { exact: true }).waitFor();
      await popup(page).getByText('Speech is unavailable. Visual alerts remain active.').waitFor();
      assert.equal(await page.evaluate(() => window.mediaLog.speech.length), 0);
      assert.equal(await popup(page).getByRole('button', { name: 'Acknowledge', exact: true }).isEnabled(), true);
    });

    await t.test('network backoff, online recovery and cross-tab logout cleanup', async () => {
      failure = 503;
      await refresh(page);
      await page.getByText('Order alerts unavailable. Reconnecting...', { exact: true }).waitFor();
      const before = calls('/api/admin/orders/notifications').length;
      await new Promise(resolve => setTimeout(resolve, 3500));
      assert.equal(calls('/api/admin/orders/notifications').length, before, 'retry backs off beyond the 3s success interval');
      failure = 0;
      await refresh(page);
      await popup(page).waitFor();
      const logoutTab = await context.newPage();
      await logoutTab.goto(origin + '/admin/menu');
      await logoutTab.getByRole('button', { name: 'Logout', exact: true }).click();
      await waitFor(async () => !(await popup(page).count()));
      const stopped = calls('/api/admin/orders/notifications').length;
      await refresh(page);
      await new Promise(resolve => setTimeout(resolve, 3500));
      assert.equal(calls('/api/admin/orders/notifications').length, stopped);
    });
    assert.ok(calls('/api/admin/orders/notifications').every(r => r.auth === 'Bearer fixture'));
    assert.deepEqual(errors, []);
  } finally {
    releasePoll?.();
    await browser?.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
