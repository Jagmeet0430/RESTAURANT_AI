// Build Admin and run npm run test:receipt first. All APIs below are isolated fixtures.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

test('Admin host printing, explicit browser fallback, settings and receipt layout', async t => {
  const root = path.resolve(__dirname, '..');
  const output = path.join(root, 'temp/thermal-receipt-validation');
  const receipt = JSON.parse(await fs.readFile(path.join(output, 'receipt-model.json'), 'utf8'));
  const layouts = {};
  for (const size of ['58', '80']) layouts[size] = JSON.parse(await fs.readFile(path.join(output, `receipt-${size}mm.json`), 'utf8'));
  const dist = path.join(root, 'admin/dist');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
  let config = { enabled: true, printerName: 'EC58B Fixture', kitchenPrinterName: '', paperWidth: '58mm',
    copies: 1, fontScale: 1, lineSpacing: 1, charactersPerLine: 28, printMode: 'windows_driver',
    logoPrinting: false, autoCut: 'driver', autoPrintKioskOrders: true };
  const printer = { name: config.printerName, driver: 'Everycom-58-Series Driver', port: 'USB001',
    status: 'Normal', printableWidthMm: 48.05, paperWidthsMm: [48.01], supportedPaperSizes: ['58mm'], virtual: false, offline: false };
  const jobs = new Map();
  const requests = [];
  let failPrinting = false;
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
        requests.push({ path: url.pathname, method: req.method, body, authorization: req.headers.authorization });
        let data = {};
        if (url.pathname.endsWith('/auth/profile')) data = { id: 1, name: 'Fixture Admin', role: 'admin' };
        else if (url.pathname === '/api/receipt-printer/settings') {
          if (req.method === 'PUT') { config = { ...body }; data = config; }
          else data = { config, printers: [printer], host: 'Restaurant-PC-Fixture', supported: true, connectionError: '' };
        } else if (url.pathname.startsWith('/api/receipt-printer/preview/')) {
          data = { receipt, ...layouts[config.paperWidth.slice(0, 2)], config, host: 'Restaurant-PC-Fixture', supported: true };
        } else if (url.pathname.startsWith('/api/receipt-printer/print/') || url.pathname === '/api/receipt-printer/test') {
          if (failPrinting) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: false, message: 'Selected receipt printer is unavailable or offline on the backend host.' }));
          }
          await new Promise(resolve => setTimeout(resolve, 150));
          if (!jobs.has(body.requestId)) jobs.set(body.requestId, { requestId: body.requestId, status: 'queued', confirmed: false });
          data = jobs.get(body.requestId);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, data }));
      }
      const relative = url.pathname.startsWith('/admin/assets/') ? url.pathname.slice('/admin/'.length) : 'index.html';
      const file = path.resolve(dist, relative);
      if (!file.startsWith(dist + path.sep)) { res.writeHead(403); return res.end(); }
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'text/plain' });
      res.end(await fs.readFile(file));
    } catch { res.writeHead(500); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  async function newPage(viewport = { width: 1280, height: 1200 }) {
    const page = await browser.newPage({ viewport });
    await page.route('**/*', request => new URL(request.request().url()).origin === origin ? request.continue() : request.abort());
    await page.addInitScript(() => {
      localStorage.setItem('authToken', 'fixture-only');
      window.receiptPrintCalls = 0;
      window.print = () => { window.receiptPrintCalls++; };
    });
    return page;
  }
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    for (const paperWidth of ['58', '80']) await t.test(`${paperWidth}mm: canonical totals, wrapping, backend auto-print and explicit browser print`, async () => {
      config.paperWidth = `${paperWidth}mm`;
      const page = await newPage();
      const before = jobs.size;
      try {
        await page.goto(origin + '/admin/receipt/order/17?print=1', { waitUntil: 'networkidle' });
        await page.getByText('Queued on the Restaurant PC. Physical printing is not confirmed.').waitFor();
        assert.equal(await page.evaluate(() => window.receiptPrintCalls), 0);
        assert.equal(jobs.size, before + 1);
        await page.reload({ waitUntil: 'networkidle' });
        await page.getByText('Queued on the Restaurant PC. Physical printing is not confirmed.').waitFor();
        assert.equal(jobs.size, before + 1, 'auto-print reload must reuse the request');
        await page.getByRole('button', { name: 'Print from this browser', exact: true }).click();
        assert.equal(await page.evaluate(() => window.receiptPrintCalls), 1);
        await page.emulateMedia({ media: 'print' });
        const boxes = await page.evaluate(() => {
          const receipt = document.querySelector('.thermal-receipt');
          const rect = receipt.getBoundingClientRect();
          return { width: rect.width, scrollWidth: receipt.scrollWidth, clientWidth: receipt.clientWidth,
            actionsHidden: getComputedStyle(document.querySelector('.receipt-actions')).display === 'none' || getComputedStyle(document.querySelector('.receipt-actions')).visibility === 'hidden',
            rows: [...document.querySelectorAll('.thermal-columns')].map(row => [...row.children].map(cell => {
              const box = cell.getBoundingClientRect();
              return { x: box.x, right: box.right, width: box.width, scroll: cell.scrollWidth };
            })) };
        });
        assert.ok(Math.abs(boxes.width - Number(paperWidth) * 96 / 25.4) < 1);
        assert.ok(boxes.scrollWidth <= boxes.clientWidth);
        assert.ok(boxes.actionsHidden, 'printer controls must not appear on paper');
        assert.equal(boxes.rows.length, layouts[paperWidth].layout.filter(row => row.type === 'table').length, 'all canonical table rows must render');
        assert.ok(boxes.rows.length >= 3, 'fixture has two items plus header');
        for (const row of boxes.rows) {
          assert.equal(row.length, 4);
          for (let index = 0; index < 4; index++) {
            assert.ok(row[index].scroll <= Math.ceil(row[index].width), 'receipt cell clipped');
            if (index) assert.ok(row[index].x > row[index - 1].right, 'receipt columns overlap');
          }
        }
        const text = await page.locator('.thermal-receipt').innerText();
        for (const phrase of ['Total Quantity', 'SGST 2.5%', 'CGST 2.5%', 'Packing', 'Round off', 'Grand Total', '210.00', 'Pending', 'Powered by Algosophix']) assert.ok(text.includes(phrase), phrase);
        await page.locator('.thermal-receipt').screenshot({ path: path.join(output, `browser-${paperWidth}mm.png`) });
        await page.pdf({ path: path.join(output, `browser-${paperWidth}mm.pdf`), preferCSSPageSize: true, printBackground: true });
      } finally { await page.close(); }
    });
    await t.test('offline host never silently falls back to the browser; retry and duplicate-click guard', async () => {
      const page = await newPage();
      config.paperWidth = '58mm';
      failPrinting = true;
      const before = jobs.size;
      try {
        await page.goto(origin + '/admin/receipt/pos/18?print=1', { waitUntil: 'networkidle' });
        await page.getByText('Selected receipt printer is unavailable or offline on the backend host.').waitFor();
        assert.equal(jobs.size, before);
        assert.equal(await page.evaluate(() => window.receiptPrintCalls), 0);
        failPrinting = false;
        const calls = requests.filter(row => row.path === '/api/receipt-printer/print/pos/18').length;
        await page.getByRole('button', { name: 'Check print request', exact: true }).evaluate(button => { button.click(); button.click(); });
        await page.getByText('Queued on the Restaurant PC. Physical printing is not confirmed.').waitFor();
        assert.equal(requests.filter(row => row.path === '/api/receipt-printer/print/pos/18').length, calls + 1);
        assert.equal(jobs.size, before + 1);
        page.once('dialog', dialog => dialog.accept());
        await page.getByRole('button', { name: 'Reprint on Restaurant PC', exact: true }).click();
        await page.getByRole('button', { name: 'Reprint on Restaurant PC', exact: true }).waitFor();
        assert.equal(jobs.size, before + 2, 'confirmed reprint must create a new reference');
      } finally { failPrinting = false; await page.close(); }
    });
    for (const viewport of [{ width: 1366, height: 768 }, { width: 1024, height: 768 }]) await t.test(`settings ${viewport.width}: host selection, save, test and preview`, async () => {
      const page = await newPage(viewport);
      config.copies = 1;
      try {
        await page.goto(origin + '/admin/settings#printer-settings', { waitUntil: 'networkidle' });
        const section = page.locator('#printer-settings');
        await section.getByText('Host: Restaurant-PC-Fixture | Normal', { exact: true }).waitFor({ state: 'attached' });
        await section.getByLabel('Copies', { exact: true }).fill('2');
        assert.equal(await section.getByRole('button', { name: 'Test Print', exact: true }).isDisabled(), true);
        await section.getByRole('button', { name: 'Save Settings', exact: true }).click();
        await section.getByText('Printer settings saved on the Restaurant PC.', { exact: true }).waitFor();
        assert.equal(config.copies, 2);
        await page.reload({ waitUntil: 'networkidle' });
        assert.equal(await section.getByLabel('Copies', { exact: true }).inputValue(), '2');
        await section.getByRole('button', { name: 'Test Print', exact: true }).click();
        await section.getByText('Test receipt queued on the Restaurant PC. Check the paper output.', { exact: true }).waitFor();
        const geometry = await section.evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth,
          overflow: [...element.querySelectorAll('input, button')].filter(node => { const a = element.getBoundingClientRect(), b = node.getBoundingClientRect(); return b.left < a.left - 1 || b.right > a.right + 1; }).length }));
        assert.ok(geometry.scroll <= geometry.width, 'settings section overflows');
        assert.equal(geometry.overflow, 0, 'settings controls overflow');
        await section.evaluate(element => element.scrollIntoView({ block: 'start' }));
        await page.screenshot({ path: path.join(output, `printer-settings-${viewport.width}.png`) });
        await section.getByRole('button', { name: 'Receipt Preview', exact: true }).click();
        await page.locator('.canonical-receipt').waitFor();
        assert.ok(page.url().endsWith('/receipt/test/preview'));
        assert.equal(await page.evaluate(() => window.receiptPrintCalls), 0);
      } finally { await page.close(); }
    });
    assert.ok(requests.filter(row => row.path.startsWith('/api/receipt-printer/')).every(row => row.authorization === 'Bearer fixture-only'));
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
