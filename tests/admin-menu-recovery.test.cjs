// Isolated API fixtures; run after the Admin build. Never connects to a database.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

test('Admin Menu recovery without false empty catalog', async t => {
  const dist = path.resolve(__dirname, '../admin/dist');
  let categoryFailure = true, menuFailure = false, syncFailure = false, empty = false;
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        let data = [], status = 200, message, code;
        switch (url.pathname) {
          case '/api/auth/profile': data = { id: 1, role: 'admin', name: 'Fixture Admin' }; break;
          case '/api/admin/orders/notifications': data = { notifications: [] }; break;
          case '/api/categories':
            if (categoryFailure) { status = 500; message = 'column m.deleted_at does not exist'; }
            else data = [{ id: 1, name: 'Bakery' }];
            break;
          case '/api/menu':
            if (menuFailure) { status = 500; message = 'Menu database unavailable'; }
            else data = empty ? [] : [{ id: 77, name: 'Preserved product', category_id: 1, category_name: 'Bakery', price: '123.45', is_available: true, image_url: '', veg_type: 'Veg' }];
            break;
          case '/api/menu/sync/status':
            if (syncFailure) { status = 503; code = 'MENU_SCHEMA_MISSING'; }
            else data = { enabled: false, state: 'disabled', pending_changes: 208, last_success_at: null };
            break;
          default: data = {};
        }
        res.writeHead(status, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: status === 200, data, message, code }));
      }
      const file = path.resolve(dist, url.pathname.startsWith('/admin/assets/') ? url.pathname.slice(7) : 'index.html');
      if (!file.startsWith(dist + path.sep)) { res.writeHead(403); return res.end(); }
      res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[path.extname(file)] || 'text/plain' });
      res.end(await fs.readFile(file));
    } catch { res.writeHead(500); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await context.addInitScript(() => localStorage.setItem('authToken', 'fixture'));
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await t.test('category SQL failure shows Retry and not No menu items found', async () => {
      await page.goto(origin + '/admin/menu');
      await page.getByText(/Menu could not load/).waitFor();
      assert.equal(await page.getByText('No menu items found', { exact: true }).count(), 0);
      assert.ok(await page.getByRole('button', { name: 'Retry menu' }).isEnabled());
    });
    await t.test('Retry restores existing product and disabled-sync status', async () => {
      categoryFailure = false; await page.getByRole('button', { name: 'Retry menu' }).click();
      await page.getByText('Preserved product', { exact: true }).waitFor();
      await page.getByText(/Cloud synchronization disabled/).waitFor();
      assert.ok((await page.locator('body').innerText()).includes('123.45'));
    });
    await t.test('menu API failure also hides false empty results', async () => {
      menuFailure = true; await page.reload(); await page.getByText(/Menu could not load/).waitFor();
      assert.equal(await page.getByText('No menu items found', { exact: true }).count(), 0);
    });
    await t.test('missing migration remains an explicit failure, not disabled sync', async () => {
      menuFailure = false; syncFailure = true; await page.reload();
      await page.getByText(/Local menu database update required/).waitFor();
      assert.equal(await page.getByText(/Cloud synchronization disabled/).count(), 0);
    });
    await t.test('genuinely empty successful response still shows empty state', async () => {
      syncFailure = false; empty = true; await page.reload(); await page.getByText('No menu items found', { exact: true }).waitFor();
      assert.equal(await page.getByText(/Menu could not load/).count(), 0); assert.deepEqual(errors, []);
    });
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
});
