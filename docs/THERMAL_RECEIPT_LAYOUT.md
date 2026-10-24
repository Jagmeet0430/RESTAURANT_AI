# Thermal receipt layout

The automatic kiosk path remains `requestKioskReceiptAutoPrint` -> `printOrderReceipt` -> saved bill -> structured layout -> `scripts/print-receipt.ps1`. Windows uses the existing printer driver/System.Drawing path, not a new raw ESC/POS transport. Fixed-width plain text remains available for monospaced consumers. Duplicate-print records, payment processing and order lifecycle are unchanged.

## Layout

Restaurant name, saved address/GSTIN when available, bill/order identifiers, emphasized token, date/time, order type and optional table/customer details appear above an Item / Qty / Rate / Amount table. Long names wrap inside their own column. Total Quantity, subtotal, discounts, applicable saved tax components, charged packing/other charges, round-off and a bold Grand Total follow. Payment method/status remain visible. The footer ends with Thank You, Please visit again, Powered by Algosophix.

Browser Bills/POS printing uses the same server-provided summary lines. POS now opens the canonical saved receipt by ID or bill number; the obsolete fallback that invented branding/GSTIN and recalculated amounts was removed. A missing saved identifier produces an error instead of a fabricated receipt. No POS checkout/payment logic was changed.

## Financial authority

- Existing checkout/POS tax calculation remains exclusive 5% GST. This release does not introduce a per-product tax engine.
- New kiosk orders (dine-in and takeaway) have zero automatic packing in the shared server totals and frontend. Other channels retain existing fees. Saved historical kiosk charges remain visible and are never rewritten.
- `receiptTotalsFromRow` uses the persisted subtotal, tax, discount, delivery/packing charge and total. It never changes a saved sale or recalculates its grand total.
- Legacy 5% rows consistent with the existing calculation use the existing `splitTaxAmount` helper. SGST and CGST amounts sum exactly to saved tax, including an odd paisa. Unknown regimes are labelled GST/Tax, not guessed as 2.5% each.
- Packing is omitted only when its saved amount is zero. Any charged fee stays visible.
- Saved round-off is shown as saved; absent round-off is 0.00. A remaining difference is explicitly labelled Saved adjustment, never silently called rounding or used to rewrite the total.
- GST-inclusive receipts use the saved tax component: net subtotal = saved inclusive subtotal - saved tax. Included GST is deducted before the net subtotal, then the same tax components are shown below it. Tax is not applied again to the payable amount.
- The subtotal is a checkpoint, not an extra charge. Taxable/exempt value rows are informational. Reconciliation is net subtotal - discount + saved tax + packing + other saved charges + saved rounding + labelled adjustment = persisted Grand Total.
- Receipt rendering does not read current menu prices or current tax settings. Stored restaurant receipt settings override live settings; historical records without a branding snapshot retain the existing live-settings fallback. No GSTIN is invented.

## Optional saved tax metadata

The reader supports `bills.receipt_settings.tax_snapshot`, inside the existing JSON field:

```json
{
  "treatment": "intra_state",
  "price_mode": "inclusive",
  "rate": 0.05,
  "taxable_subtotal": 100,
  "exempt_subtotal": 50,
  "round_off": 0,
  "components": [
    { "label": "SGST", "rate": 0.025, "amount": 2.5 },
    { "label": "CGST", "rate": 0.025, "amount": 2.5 }
  ],
  "charges": []
}
```

Rates are fractions. Explicit components must sum to the saved tax or the receipt falls back to a generic tax line. `inter_state` uses IGST without an intra-state split. Other components and charges use their saved labels/amounts. Inclusive/exclusive and taxable/exempt values must describe the original transaction, not a newly selected setting.

**This is a read-only receipt contract, not a new checkout tax engine.** Current order/POS creation does not write configurable jurisdiction, inclusive-pricing or per-item exemption snapshots. Enabling those sale modes requires a separately approved billing/persistence change. Do not manually backfill metadata or infer historical jurisdiction to make a receipt look different.

## Widths and validation

- Existing text defaults: 28 characters at 58mm, 42 at 80mm. Optional `charactersPerLine` in printer JSON accepts 24-64 for an explicitly configured monospaced printer. No installed configuration was changed.
- Windows drawing measures numeric columns with the actual font and available printable width; names receive the remaining width. Numeric values are not truncated. An impossible width fails with an explicit error.
- Browser receipt grid sizes numeric columns from displayed values and uses a named 58mm print page. Print controls and Admin navigation are excluded from receipt printing.
- `print-receipt.ps1 -JobPath <fixture.json> -PreviewPath <preview.png>` runs the same measurement/drawing functions without accessing a printer. Previews model 48mm/72mm printable areas; physical driver margins still need verification.
- Automated tests cover saved settings/totals, discounts, paid/pending receipts, packing, rounding, unknown adjustments, mixed taxable/exempt snapshots, IGST, inclusive prices, other components, odd-paisa tax, zero-priced lines, large numbers, long names and duplicate-print suppression.

From the repository run `npm ci`, build Admin with `npm --prefix admin run build`, then run `npm test`. Root development dependencies pin Playwright and PostCSS in package-lock.json; no NODE_PATH workaround is needed. Tests use installed Microsoft Edge on Windows and Node 26.4.0 with the module-mocking flag supplied by `test:receipt`. Node module mocks remain experimental. Fixtures and image/PDF previews are written under ignored `temp/thermal-receipt-validation`.

No physical printer test has been performed. Deploy the matching backend, Windows print script and rebuilt Admin together through the 1.4.6 upgrade package. See RELEASE_1.4.6.md for validation and rollout gates.
