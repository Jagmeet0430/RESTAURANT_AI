import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateOrderTotals, receiptTotalsFromRow } from '../src/services/orderTotalsService.js';

test('website pickup removes the transaction packing fee, retaining server GST and discounts', () => {
  const totals = calculateOrderTotals({ subtotal: 90, orderType: 'pickup', orderSource: 'website', discount: 4.5 });
  assert.equal(totals.subtotal, 90);
  assert.equal(totals.tax, 4.5);
  assert.equal(totals.cgst + totals.sgst, totals.tax);
  assert.equal(totals.packing, 0);
  assert.equal(totals.deliveryCharge, 0);
  assert.equal(totals.total, 90);
});

test('website uses the supplied GST rate, including exempt and fractional totals', () => {
  for (const [gstRate, tax, total] of [[0, 0, 90], [.05, 4.5, 94.5], [.12, 10.8, 100.8]]) {
    const result = calculateOrderTotals({ subtotal: 90, orderSource: 'website', gstRate });
    assert.equal(result.tax, tax);
    assert.equal(result.total, total);
  }
});

test('website release does not change HEAD local/kiosk/POS pickup fees', () => {
  for (const orderSource of ['customer_web', 'kiosk', 'pos', 'table_qr', null]) {
    const result = calculateOrderTotals({ subtotal: 90, orderSource });
    assert.equal(result.deliveryCharge, 10);
    assert.equal(result.total, 104.5);
  }
});

test('empty website baskets and dine-in keep their existing zero packing rule', () => {
  assert.equal(calculateOrderTotals({ subtotal: 0, orderSource: 'website' }).total, 0);
  assert.equal(calculateOrderTotals({ subtotal: 90, orderType: 'dine_in', orderSource: 'pos' }).deliveryCharge, 0);
});

test('historical receipts retain the saved packing and grand total', () => {
  const receipt = receiptTotalsFromRow({ subtotal: 90, tax: 4.5, delivery_charge: 10, total_amount: 104.5 });
  assert.equal(receipt.packing, 10);
  assert.equal(receipt.tax, 4.5);
  assert.equal(receipt.grand_total, 104.5);
});
