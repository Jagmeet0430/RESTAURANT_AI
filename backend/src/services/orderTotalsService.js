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
  gstRate = DEFAULT_GST_RATE,
  packingCharge = DEFAULT_PACKING_CHARGE,
  discount = 0,
} = {}) {
  const safeSubtotal = money(subtotal);
  const safeDiscount = money(discount);
  const normalizedOrderType = normalizeOrderTypeForTotals(orderType);
  const tax = money(safeSubtotal * Number(gstRate || 0));
  const { cgst, sgst } = splitTaxAmount(tax);
  const packing = isDineInOrderType(normalizedOrderType)
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
  const { cgst, sgst } = splitTaxAmount(tax);
  return {
    subtotal,
    discount: money(row.discount),
    tax,
    cgst,
    sgst,
    cgst_rate: DEFAULT_GST_RATE / 2,
    sgst_rate: DEFAULT_GST_RATE / 2,
    packing: money(row.delivery_charge),
    grand_total: money(row.total_amount),
  };
}
