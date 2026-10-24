import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { calculateOrderTotals, receiptTotalsFromRow } from '../src/services/orderTotalsService.js';

const exec = promisify(execFile);
const repo = path.resolve(import.meta.dirname, '../..');
const savedBill = {
  id: 42, order_id: 17, bill_number: 'BILL-2026-000042', order_number: 'ORD-2026-000017', token_number: 27,
  order_type: 'dine_in', payment_method: 'Cash', payment_status: 'Paid', created_at: '2026-10-17T07:00:00Z',
  subtotal: 200, tax: 10, discount: 10, delivery_charge: 10, total_amount: 210,
  line_items: [
    { name: 'Extra Cheese Corn Roll With Special Toppings', quantity: 2, unit_price: 60, total_price: 120 },
    { name: 'SuperLongUnbrokenBakeryProductNameForWrapping', quantity: 1, unit_price: 80, total_price: 80 },
  ],
  receipt_settings: { restaurant_name: 'Mahesh Sweets and Bakers', address: 'Fixture address for receipt testing only',
    gstin: 'TEST-GSTIN', footer_text: 'Thank You' },
};
const database = { query: async sql => {
  if (sql.includes('FROM bills b')) return { rowCount: 1, rows: [structuredClone(savedBill)] };
  if (sql.includes('SELECT value FROM app_settings')) return { rowCount: 1, rows: [{ value: { restaurantName: 'Changed settings', gst: 'CHANGED-GSTIN' } }] };
  return { rowCount: 0, rows: [] };
} };
mock.module('../src/config/database.js', { exports: { pool: database } });
const { getOrderReceipt, getCounterSaleReceipt, getTestReceipt } = await import('../src/services/billingService.js');
const { buildThermalReceiptLayout, buildThermalReceiptText, printOrderReceipt } = await import('../src/services/receiptPrinterService.js');

const receiptFor = row => ({ source_type: 'order', source_id: 17, bill_number: savedBill.bill_number,
  order_number: savedBill.order_number, token_number: 27, created_at: savedBill.created_at, order_type: 'dine_in',
  payment_method: 'Pay at Counter', payment_status: 'Pending', restaurant: savedBill.receipt_settings,
  items: savedBill.line_items, totals: receiptTotalsFromRow(row) });
const cents = value => Math.round(Number(value) * 100);
function reconciles(totals) {
  assert.equal(cents(totals.display_subtotal) - cents(totals.discount) + cents(totals.tax) + cents(totals.packing) +
    cents(totals.round_off) + cents(totals.adjustment) + totals.charges.reduce((sum, entry) => sum + cents(entry.amount), 0), cents(totals.grand_total));
  assert.equal(cents(totals.display_subtotal) + (totals.prices_include_tax ? cents(totals.tax) : 0), cents(totals.subtotal));
  assert.equal(totals.tax_lines.reduce((sum, entry) => sum + cents(entry.amount), 0), cents(totals.tax));
}

function assertOnlyLegacyLinkMaintenance(queries) {
  // Existing schema setup backfills links, but receipt reads must not create or reprice sales.
  assert.deepEqual(queries.filter(sql => /^\s*(?:INSERT|UPDATE|DELETE)\b/i.test(sql)), [
    "UPDATE bills SET source_type = 'order', source_id = order_id WHERE source_id IS NULL AND order_id IS NOT NULL",
    "UPDATE payments SET source_type = 'order', source_id = order_id WHERE source_id IS NULL AND order_id IS NOT NULL",
  ]);
}

test('existing exclusive checkout calculation remains unchanged', () => {
  const totals = calculateOrderTotals({ subtotal: 200, orderType: 'pickup', discount: 10 });
  assert.equal(totals.total, 210);
  assert.equal(totals.tax, 10);
  assert.equal(totals.packing, 10);
});

test('kiosk dine-in and takeaway never charge packing; other channels and saved bills retain fees', () => {
  for (const orderType of ['dine_in', 'pickup', 'takeaway']) {
    const totals = calculateOrderTotals({ subtotal: 200, orderType, orderSource: 'kiosk', packingCharge: 25 });
    assert.equal(totals.packing, 0);
    assert.equal(totals.deliveryCharge, 0);
    assert.equal(totals.total, 210);
    const receipt = receiptTotalsFromRow({ subtotal: totals.subtotal, tax: totals.tax,
      delivery_charge: totals.deliveryCharge, total_amount: totals.total });
    reconciles(receipt);
    assert.ok(!receipt.summary_lines.some(line => line.label === 'Packing'));
  }
  assert.equal(calculateOrderTotals({ subtotal: 200, orderSource: 'website' }).packing, 0);
  assert.equal(receiptTotalsFromRow({ ...savedBill, order_source: 'website' }).packing, 10);
  for (const orderSource of [undefined, 'customer_web', 'pos']) {
    assert.equal(calculateOrderTotals({ subtotal: 200, orderType: 'pickup', orderSource }).packing, 10);
  }
  assert.equal(receiptTotalsFromRow({ ...savedBill, order_source: 'kiosk' }).packing, 10);
});

test('saved bill/settings win over changed live settings; no mutation or financial update', async () => {
  const original = JSON.stringify(savedBill);
  const receipt = await getOrderReceipt(database, 17);
  assert.equal(receipt.restaurant.restaurant_name, savedBill.receipt_settings.restaurant_name);
  assert.equal(receipt.restaurant.gstin, 'TEST-GSTIN');
  assert.equal(receipt.totals.grand_total, savedBill.total_amount);
  assert.equal(receipt.items.reduce((sum, item) => sum + cents(item.total_price), 0), cents(receipt.totals.subtotal));
  assert.deepEqual(receipt.totals.tax_lines.map(entry => entry.label), ['SGST', 'CGST']);
  assert.equal(JSON.stringify(savedBill), original);
  reconciles(receipt.totals);
});

test('POS receipt lookup accepts saved sale ID or bill number without recalculating the sale', async () => {
  for (const lookup of [18, 'POS-2026-000018']) {
    const queries = [];
    const client = { query: async (sql, values) => {
      queries.push({ sql, values });
      if (sql.includes('FROM counter_sales cs')) return { rowCount: 1, rows: [{
        id: 18, bill_number: 'POS-2026-000018', subtotal: 200, gst_amount: 36, total_amount: 236,
        payment_method: 'Card', payment_status: 'Paid', created_at: savedBill.created_at,
      }] };
      if (sql.includes('FROM counter_sale_items csi')) return { rowCount: 1, rows: [{
        name: 'Saved POS item', quantity: 2, unit_price: 100, line_total: 200,
      }] };
      return { rowCount: 0, rows: [] };
    } };
    const receipt = await getCounterSaleReceipt(client, lookup);
    const saleQuery = queries.find(entry => entry.sql.includes('FROM counter_sales cs'));
    assert.deepEqual(saleQuery.values, [lookup]);
    assert.ok(saleQuery.sql.includes(typeof lookup === 'number' ? 'cs.id = $1' : 'cs.bill_number = $1'));
    assert.equal(receipt.source_type, 'counter_sale');
    assert.equal(receipt.source_id, 18);
    assert.equal(receipt.payment_method, 'Card');
    assert.equal(receipt.payment_status, 'Paid');
    assert.equal(receipt.items[0].total_price, 200);
    assert.equal(receipt.totals.tax, 36);
    assert.equal(receipt.totals.grand_total, 236);
    assert.equal(receipt.totals.adjustment, 0);
    reconciles(receipt.totals);
    assertOnlyLegacyLinkMaintenance(queries.map(entry => entry.sql));
  }
});

test('test receipt uses canonical totals without creating a sale', async () => {
  const queries = [];
  const client = { query: async sql => { queries.push(sql); return { rowCount: 0, rows: [] }; } };
  const receipt = await getTestReceipt(client);
  assert.equal(receipt.source_type, 'test');
  assert.equal(receipt.is_test_receipt, true);
  assert.equal(receipt.payment_status, 'Unpaid');
  assert.equal(receipt.items.reduce((sum, item) => sum + item.total_price, 0), 15);
  assert.equal(receipt.totals.grand_total, 15);
  assert.equal(receipt.totals.adjustment, 0);
  reconciles(receipt.totals);
  assertOnlyLegacyLinkMaintenance(queries);
});

const cases = [
  ['legacy 5%, discount and charged packing', { ...savedBill }, ['SGST 2.5%', 'CGST 2.5%', 'Packing', 'Discount']],
  ['positive rounding', { ...savedBill, round_off: 0.25, total_amount: 210.25 }, ['Round off']],
  ['negative rounding', { ...savedBill, round_off: -0.25, total_amount: 209.75 }, ['Round off']],
  ['odd paisa tax split preserves both components', { subtotal: 0.2, tax: 0.01, total_amount: 0.21 }, ['SGST 2.5%', 'CGST 2.5%']],
  ['unknown historical difference is not invented rounding', { ...savedBill, total_amount: 213 }, ['Saved adjustment']],
  ['unknown tax regime stays generic', { subtotal: 200, tax: 36, total_amount: 236 }, ['GST/Tax']],
  ['saved 18% intra-state', { subtotal: 200, tax: 36, total_amount: 236,
    receipt_settings: { tax_snapshot: { treatment: 'intra_state', rate: 0.18 } } }, ['SGST 9%', 'CGST 9%']],
  ['saved interstate IGST', { subtotal: 200, tax: 10, total_amount: 210,
    receipt_settings: { tax_snapshot: { treatment: 'inter_state', rate: 0.05 } } }, ['IGST 5%']],
  ['inclusive mixed taxable and exempt, no double tax', { subtotal: 155, tax: 5, total_amount: 155,
    receipt_settings: { tax_snapshot: { treatment: 'intra_state', rate: 0.05, price_mode: 'inclusive', taxable_subtotal: 100, exempt_subtotal: 50 } } },
    ['Included GST', 'Subtotal (excl. GST)', 'Taxable value', 'Exempt value', 'SGST 2.5%', 'CGST 2.5%']],
  ['inclusive IGST with discount', { subtotal: 210, tax: 10, discount: 5, total_amount: 205,
    receipt_settings: { tax_snapshot: { treatment: 'inter_state', rate: 0.05, price_mode: 'inclusive' } } }, ['Included GST', 'IGST 5%', 'Discount']],
  ['saved components and other charge', { subtotal: 200, tax: 11, total_amount: 216,
    receipt_settings: { tax_snapshot: { components: [{ label: 'CGST', amount: 5, rate: 0.025 }, { label: 'SGST', amount: 5, rate: 0.025 },
      { label: 'Cess', amount: 1 }], charges: [{ label: 'Service charge', amount: 5 }] } } }, ['Cess', 'Service charge']],
  ['inconsistent components do not change tax', { subtotal: 200, tax: 10, total_amount: 210,
    receipt_settings: { tax_snapshot: { components: [{ label: 'IGST', amount: 99 }] } } }, ['GST/Tax']],
  ['exempt no tax or packing', { subtotal: 200, tax: 0, total_amount: 200,
    receipt_settings: { tax_snapshot: { treatment: 'exempt', exempt_subtotal: 200 } } }, ['Exempt value']],
];
for (const [name, row, labels] of cases) {
  test(name, () => {
    const totals = receiptTotalsFromRow(row);
    reconciles(totals);
    assert.equal(totals.grand_total, row.total_amount);
    for (const label of labels) assert.ok(totals.summary_lines.some(entry => entry.label === label), label);
    if (name.includes('IGST')) assert.equal(totals.cgst + totals.sgst, 0);
    if (!row.delivery_charge) assert.ok(!totals.summary_lines.some(entry => entry.label === 'Packing'));
    for (const paperWidth of ['58mm', '80mm']) {
      const receipt = receiptFor(row);
      receipt.items = [{ name: 'Saved transaction item', quantity: 1, unit_price: row.subtotal, total_price: row.subtotal }];
      const text = buildThermalReceiptText(receipt, { paperWidth });
      const layout = buildThermalReceiptLayout(receipt, { paperWidth });
      assert.equal(layout.find(entry => entry.style === 'total').right, `Rs. ${row.total_amount.toFixed(2)}`);
      assert.equal(cents(receipt.items[0].total_price), cents(totals.subtotal));
      assert.doesNotMatch(text, /NaN|undefined/);
    }
  });
}

for (const paperWidth of ['58mm', '80mm']) {
  test(`${paperWidth}: four columns, full names, exact decimals, token, payment and footer`, async () => {
    const receipt = receiptFor(savedBill);
    const width = paperWidth === '58mm' ? 28 : 42;
    const text = buildThermalReceiptText(receipt, { paperWidth });
    const layout = buildThermalReceiptLayout(receipt, { paperWidth });
    for (const line of text.split('\r\n')) assert.ok(line.length <= width, line);
    assert.match(text, /Item\s+Qty\s+Rate\s+Amount/);
    assert.match(text, /Total Quantity\s+3/);
    assert.match(text, /Grand Total\s+Rs\. 210\.00/);
    assert.match(text, /SGST 2\.5%\s+Rs\. 5\.00/);
    assert.match(text, /CGST 2\.5%\s+Rs\. 5\.00/);
    assert.match(text, /Powered by Algosophix/);
    assert.match(text, /Status: Pending/);
    assert.ok(layout.some(entry => entry.style === 'token' && entry.text === 'TOKEN: 27'));
    assert.ok(layout.some(entry => entry.style === 'total' && entry.right === 'Rs. 210.00'));
    assert.deepEqual(layout.filter(entry => entry.type === 'table').slice(1).map(entry => entry.cells[0]), savedBill.line_items.map(item => item.name));
    const noGst = structuredClone(receipt);
    noGst.restaurant.gstin = '';
    noGst.payment_status = 'Paid';
    const paidText = buildThermalReceiptText(noGst, { paperWidth });
    assert.doesNotMatch(paidText, /GSTIN:/);
    assert.match(paidText, /Status: Paid/);
    const output = path.join(repo, 'temp/thermal-receipt-validation');
    await fs.mkdir(output, { recursive: true });
    await fs.writeFile(path.join(output, `receipt-${paperWidth}.txt`), text);
    await fs.writeFile(path.join(output, `receipt-${paperWidth}.json`), JSON.stringify({ paperWidth, layout, text }));
    await fs.writeFile(path.join(output, 'receipt-model.json'), JSON.stringify(receipt));
    const preview = await exec('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(repo, 'scripts/print-receipt.ps1'),
      '-JobPath', path.join(output, `receipt-${paperWidth}.json`), '-ConfigPath', path.join(output, 'not-a-printer-config.json'),
      '-PreviewPath', path.join(output, `receipt-${paperWidth}.png`)], { windowsHide: true, timeout: 30000 });
    assert.match(preview.stdout, /no printer accessed/);
    assert.ok((await fs.stat(path.join(output, `receipt-${paperWidth}.png`))).size > 1000);
  });
}

test('configured character width and saved zero line amount are preserved', () => {
  const receipt = receiptFor({ subtotal: 0, tax: 0, total_amount: 0 });
  receipt.items = [{ name: 'Complimentary item', quantity: 2, unit_price: 10, total_price: 0 }];
  const layout = buildThermalReceiptLayout(receipt, { paperWidth: '58mm', charactersPerLine: 32 });
  assert.equal(layout.find(entry => entry.type === 'table' && entry.style === 'normal').cells[3], '0.00');
  for (const line of buildThermalReceiptText(receipt, { paperWidth: '58mm', charactersPerLine: 32 }).split('\r\n')) assert.ok(line.length <= 32);
});

test('large numeric fields remain intact; impossible widths fail rather than truncate money', () => {
  const receipt = receiptFor({ subtotal: 10000, tax: 500, total_amount: 10500 });
  receipt.items = [{ name: 'Celebration cake', quantity: 10, unit_price: 1000, total_price: 10000 }];
  for (const paperWidth of ['58mm', '80mm']) {
    const text = buildThermalReceiptText(receipt, { paperWidth });
    assert.match(text, /10\s+1000\.00\s+10000\.00/);
    for (const line of text.split('\r\n')) assert.ok(line.length <= (paperWidth === '58mm' ? 28 : 42));
  }
  receipt.items[0].total_price = 9999999999999;
  assert.throws(() => buildThermalReceiptText(receipt, { paperWidth: '58mm' }), /too narrow/);
});

test('auto-print transport still spools one job and suppresses duplicate order printing (mock printer only)', async () => {
  const state = await fs.mkdtemp(path.join(os.tmpdir(), 'restaurantai-receipt-layout-'));
  const envKeys = ['RESTAURANTAI_PRINTER_STATE_ROOT', 'RESTAURANTAI_PRINTER_CONFIG', 'RESTAURANTAI_PRINT_SCRIPT'];
  const previous = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  try {
    await fs.mkdir(path.join(state, 'config'));
    const config = path.join(state, 'config/printer.json');
    await fs.writeFile(config, JSON.stringify({ enabled: true, printerName: 'Fixture only', paperWidth: '58mm', autoPrintKioskOrders: true }));
    const script = path.join(state, 'mock-print.ps1');
    await fs.writeFile(script, "param([string]$JobPath,[string]$ConfigPath)\nWrite-Host 'mock spool only'\n");
    Object.assign(process.env, { RESTAURANTAI_PRINTER_STATE_ROOT: state, RESTAURANTAI_PRINTER_CONFIG: config, RESTAURANTAI_PRINT_SCRIPT: script });
    const first = await printOrderReceipt(database, 17, { source: 'kiosk' });
    assert.equal(first.printed, true);
    const second = await printOrderReceipt(database, 17, { source: 'kiosk' });
    assert.equal(second.reason, 'already_printed');
    const jobs = await fs.readdir(path.join(state, 'runtime/receipt-print-jobs'));
    assert.equal(jobs.length, 1);
    const job = JSON.parse(await fs.readFile(path.join(state, 'runtime/receipt-print-jobs', jobs[0]), 'utf8'));
    assert.ok(job.layout.some(entry => entry.type === 'table'));
    assert.match(job.text, /Powered by Algosophix/);
  } finally {
    for (const key of envKeys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
    assert.ok(path.resolve(state).startsWith(path.join(os.tmpdir(), 'restaurantai-receipt-layout-')));
    await fs.rm(state, { recursive: true, force: true });
  }
});
