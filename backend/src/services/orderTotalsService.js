export const DEFAULT_GST_RATE = 0.05;
export const DEFAULT_PACKING_CHARGE = 10;

export function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

export function normalizeOrderTypeForTotals(value) {
  const normalized = String(value || "pickup").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "dinein") return "dine_in";
  if (["pickup", "takeaway", "delivery", "dine_in", "counter_sale", "test"].includes(normalized)) {
    return normalized === "takeaway" ? "pickup" : normalized;
  }
  return "pickup";
}

export function isDineInOrderType(value) {
  return normalizeOrderTypeForTotals(value) === "dine_in";
}

export function splitTaxAmount(totalTax) {
  const tax = money(totalTax);
  const cgst = money(tax / 2);
  const sgst = money(tax - cgst);
  return { cgst, sgst };
}

export function calculateOrderTotals({
  subtotal,
  orderType = "pickup",
  orderSource = null,
  gstRate = DEFAULT_GST_RATE,
  packingCharge = DEFAULT_PACKING_CHARGE,
  discount = 0,
} = {}) {
  const safeSubtotal = money(subtotal);
  const safeDiscount = money(discount);
  const normalizedOrderType = normalizeOrderTypeForTotals(orderType);
  const tax = money(safeSubtotal * Number(gstRate || 0));
  const { cgst, sgst } = splitTaxAmount(tax);
  const packing = ["kiosk", "website"].includes(orderSource) || isDineInOrderType(normalizedOrderType)
    ? 0
    : safeSubtotal > 0
    ? money(packingCharge)
    : 0;

  return {
    subtotal: safeSubtotal,
    tax,
    cgst,
    sgst,
    gstRate: Number(gstRate || 0),
    cgstRate: Number(gstRate || 0) / 2,
    sgstRate: Number(gstRate || 0) / 2,
    packing,
    deliveryCharge: packing,
    discount: safeDiscount,
    total: money(safeSubtotal + tax + packing - safeDiscount),
    orderType: normalizedOrderType,
  };
}

export function receiptTotalsFromRow(row = {}) {
  const subtotal = money(row.subtotal);
  const tax = money(row.tax ?? row.gst_amount);
  // Only transaction-saved metadata may describe a different tax treatment.
  // Current settings must never reprice an old bill. Legacy checkout was 5% exclusive.
  const snapshot = row.receipt_settings?.tax_snapshot || {};
  const savedRate = value => value != null && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
  const inclusive = snapshot.price_mode === 'inclusive';
  const displaySubtotal = money(subtotal - (inclusive ? tax : 0));
  const discount = money(row.discount);
  const packing = money(row.delivery_charge);
  const grandTotal = money(row.total_amount);
  const roundOff = money(snapshot.round_off ?? row.round_off);
  const charges = (Array.isArray(snapshot.charges) ? snapshot.charges : [])
    .filter(entry => entry && typeof entry.label === 'string' && Number.isFinite(Number(entry.amount)))
    .map(entry => ({ label: entry.label, amount: money(entry.amount) }));
  let taxLines = [];
  const components = snapshot.components;
  if (Array.isArray(components) && components.length &&
      components.every(entry => entry && typeof entry.label === 'string' &&
        Number.isFinite(Number(entry.amount)) && Number(entry.amount) >= 0) &&
      money(components.reduce((sum, entry) => sum + Number(entry.amount), 0)) === tax) {
    taxLines = components.map(entry => ({ label: entry.label, amount: money(entry.amount),
      rate: savedRate(entry.rate) }));
  } else if (!components && snapshot.treatment === 'inter_state') {
    taxLines = [{ label: 'IGST', amount: tax, rate: savedRate(snapshot.rate) }];
  } else if (!components && (snapshot.treatment === 'intra_state' ||
      (!snapshot.treatment && !inclusive && money(subtotal * DEFAULT_GST_RATE) === tax))) {
    const split = splitTaxAmount(tax);
    const rate = savedRate(snapshot.rate) ?? (!snapshot.treatment ? DEFAULT_GST_RATE : null);
    taxLines = [
      { label: 'SGST', amount: split.sgst, rate: rate == null ? null : Number(rate) / 2 },
      { label: 'CGST', amount: split.cgst, rate: rate == null ? null : Number(rate) / 2 },
    ];
  } else if (tax) {
    taxLines = [{ label: 'GST/Tax', amount: tax, rate: null }];
  }
  taxLines = tax ? taxLines : [];
  const componentAmount = label => money(taxLines.filter(entry => entry.label === label).reduce((sum, entry) => sum + entry.amount, 0));
  const componentRate = label => taxLines.find(entry => entry.label === label)?.rate ?? null;
  const adjustment = money(grandTotal - money(displaySubtotal - discount + tax + packing + roundOff +
    charges.reduce((sum, entry) => sum + entry.amount, 0)));
  const summaryLines = [];
  if (inclusive) summaryLines.push({ label: 'Included GST', amount: -tax });
  summaryLines.push({ label: inclusive ? 'Subtotal (excl. GST)' : 'Subtotal', amount: displaySubtotal });
  if (discount) summaryLines.push({ label: 'Discount', amount: -discount });
  if (snapshot.taxable_subtotal != null) summaryLines.push({ label: 'Taxable value', amount: money(snapshot.taxable_subtotal), informational: true });
  if (snapshot.exempt_subtotal != null) summaryLines.push({ label: 'Exempt value', amount: money(snapshot.exempt_subtotal), informational: true });
  for (const entry of taxLines) {
    const rate = entry.rate == null ? '' : ` ${Number((Number(entry.rate) * 100).toFixed(4))}%`;
    summaryLines.push({ label: entry.label + rate, amount: entry.amount });
  }
  if (packing) summaryLines.push({ label: 'Packing', amount: packing });
  summaryLines.push(...charges, { label: 'Round off', amount: roundOff });
  if (adjustment) summaryLines.push({ label: 'Saved adjustment', amount: adjustment });
  return {
    subtotal,
    discount,
    tax,
    cgst: componentAmount('CGST'),
    sgst: componentAmount('SGST'),
    igst: componentAmount('IGST'),
    cgst_rate: componentRate('CGST'),
    sgst_rate: componentRate('SGST'),
    packing,
    grand_total: grandTotal,
    display_subtotal: displaySubtotal,
    prices_include_tax: inclusive,
    round_off: roundOff,
    adjustment,
    charges,
    tax_lines: taxLines,
    summary_lines: summaryLines,
  };
}
