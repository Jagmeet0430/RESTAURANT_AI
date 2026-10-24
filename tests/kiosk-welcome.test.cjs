// Run npm ci at the repository root first. All API data is local fixtures.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const postcss = require('postcss');

const root = path.resolve(__dirname, '..');
const frontend = path.join(root, 'frontend');
const output = path.join(root, 'temp/kiosk-welcome-validation');
const baseline = Object.fromEntries(['script.js', 'styles.css'].map(file =>
  [file, execFileSync('git', ['show', `HEAD:frontend/${file}`], { cwd: root })]));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };

test('kiosk attract portrait typography and isolated visual regressions', { timeout: 120000 }, async t => {
  postcss.parse(await fs.readFile(path.join(frontend, 'styles.css'), 'utf8'));
  await fs.mkdir(output, { recursive: true });
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        assert.equal(req.method, 'GET', 'UI test must not submit an order');
        const data = url.pathname === '/api/menu'
          ? [{ id: 1, name: 'Cheese Corn Roll', category: 'Puffs Patties & Rolls', price: 90, is_available: true }]
          : url.pathname === '/api/settings/public'
            ? { restaurantName: 'Mahesh sweets and Bakers', kioskDisplayMode: 'auto' }
            : url.pathname.startsWith('/api/tables/public/')
              ? { table: { id: 1, table_number: '1', display_name: 'Table 1' } }
              : { online_enabled: false };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, data }));
      }
      const before = url.pathname.startsWith('/baseline/');
      let relative = decodeURIComponent(url.pathname.replace(/^\/baseline/, '')).replace(/^\//, '');
      if (!relative || relative === 'customer') relative = 'index.html';
      const file = path.resolve(frontend, relative);
      if (!file.startsWith(frontend + path.sep)) { res.writeHead(403); return res.end(); }
      const bytes = before && baseline[relative] ? baseline[relative] : await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
      res.end(bytes);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  const open = async (viewport, route) => {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', request => new URL(request.request().url()).origin === origin
      ? request.continue() : request.abort());
    await page.addInitScript(api => { window.RESTAURANTAI_API_BASE_URL = api; }, origin + '/api');
    await page.goto(origin + route, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    assert.deepEqual(errors, []);
    return page;
  };
  try {
    browser = await chromium.launch({ channel: process.env.KIOSK_TEST_BROWSER || 'msedge', headless: true });
    for (const [width, height] of [[1080, 1920], [768, 1366], [1366, 768], [1920, 1080], [640, 960], [375, 812]]) {
      await t.test(`welcome ${width}x${height}: centered, no overflow, Start order navigates`, async () => {
        const page = await open({ width, height }, '/customer?kiosk=1');
        try {
          assert.deepEqual(await page.locator('#kioskAttractTitle span').allTextContents(), ['ORDER', 'HERE', 'PLEASE']);
          const layout = await page.evaluate(() => {
            const selectors = ['#kioskAttractTitle', '.kiosk-attract-hand', '.kiosk-attract p'];
            return { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight,
              elements: selectors.map(selector => {
                const element = document.querySelector(selector), r = element.getBoundingClientRect(), s = getComputedStyle(element);
                return { x: r.x, y: r.y, width: r.width, height: r.height, font: parseFloat(s.fontSize) };
              }) };
          });
          assert.ok(layout.width <= width && layout.height <= height, 'welcome must fit screen');
          layout.elements.forEach((box, index) => {
            assert.ok(box.x >= 0 && box.x + box.width <= width && box.y + box.height <= height);
            assert.ok(Math.abs(box.x + box.width / 2 - width / 2) < 1, 'centered horizontally');
            if (index) assert.ok(box.y >= layout.elements[index - 1].y + layout.elements[index - 1].height - 1, 'no overlap');
          });
          assert.ok(layout.elements[0].font >= 64, 'headline readable from a distance');
          assert.ok(layout.elements[0].font > layout.elements[2].font * 2);
          assert.ok(layout.elements[1].height >= 64);
          assert.ok(await page.locator('.kiosk-attract-photo').evaluate(img => img.complete && img.naturalWidth > 0));
          assert.ok(await page.locator('.kiosk-attract-hand').evaluate(img => img.complete && img.naturalWidth > 0));
          assert.ok(await page.locator('.kiosk-brand img').evaluate(img => img.complete && img.naturalWidth > 0));
          await page.screenshot({ path: path.join(output, `welcome-${width}x${height}.png`), animations: 'disabled' });
          await page.getByRole('button', { name: 'Start order', exact: true }).click();
          await page.getByRole('heading', { name: 'How would you like your order?' }).waitFor();
          await page.waitForTimeout(500);
          await page.locator('[data-kiosk-order-type="dine_in"]').click();
          await page.locator('.kiosk-menu-item').waitFor();
        } finally { await page.close(); }
      });
    }
    await t.test('kiosk dine-in and takeaway display zero packing and matching payable total', async () => {
      for (const orderType of ['dine_in', 'takeaway']) {
        const page = await open({ width: 1080, height: 1920 }, '/customer?kiosk=1');
        try {
          await page.locator('[data-kiosk-action="start"]').click();
          await page.waitForTimeout(500);
          await page.locator(`[data-kiosk-order-type="${orderType}"]`).click();
          await page.locator('[data-kiosk-add="1"]').click();
          const lines = page.locator('.kiosk-totals');
          assert.match(await lines.innerText(), /Packing\s+Rs\. 0/);
          assert.match(await lines.innerText(), /Total\s+Rs\. 94\.50/i);
        } finally { await page.close(); }
      }
    });
    for (const [width, height, route, label] of [
      // Public storefront visuals intentionally changed; covered by customer-usability.test.cjs.
      [768, 1366, '/customer?kiosk=1', 'kiosk-ordering'],
    ]) {
      await t.test(`${label}: unchanged screenshot against HEAD`, async () => {
        const screenshots = [];
        for (const prefix of ['/baseline', '']) {
          const page = await open({ width, height }, prefix + route);
          try {
            if (label === 'kiosk-ordering') {
              await page.locator('[data-kiosk-action="start"]').click();
              await page.waitForTimeout(500);
              await page.locator('[data-kiosk-order-type="dine_in"]').click();
              await page.locator('.kiosk-menu-item').waitFor();
            } else assert.equal(await page.locator('.kiosk-welcome').count(), 0);
            await page.evaluate(() => Promise.all([...document.images].map(img => img.decode().catch(() => {}))));
            screenshots.push(await page.screenshot({ fullPage: true, animations: 'disabled',
              path: path.join(output, `${label}-${prefix ? 'before' : 'after'}.png`) }));
          } finally { await page.close(); }
        }
        assert.ok(screenshots[0].equals(screenshots[1]), `${label} screenshot changed`);
      });
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
