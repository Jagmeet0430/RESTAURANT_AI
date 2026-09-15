import { pool } from "../config/database.js";
import { receiptTotalsFromRow } from "./orderTotalsService.js";

const BILL_PREFIX = "BILL";
const POS_BILL_PREFIX = "POS";
const SETTINGS_KEY = "restaurant";
const defaultReceiptSettings = {
  restaurantName: "MAHESH Sweets & Bakers",
  gst: "",
  address: "Jaja Chowk, Opp. State Bank of India, Tanda, Punjab-144024, India",
  phone: "",
  footerText: "Thank You",
  receiptWidth: "80",
  autoOpenReceiptAfterPayment: "false",
};
const paymentMethodLabels = new Map([
  ["cash", "Cash"],
  ["upi", "UPI"],
  ["card", "Card"],
  ["pay_at_counter", "Pay at Counter"],
  ["pay at counter", "Pay at Counter"],
  ["cash_on_delivery", "Cash on Delivery"],
]);

async function queryWith(client, sql, params = []) {
  return client.query(sql, params);
}

export async function ensureBillingSchema(client = pool) {
  await queryWith(client, "CREATE SEQUENCE IF NOT EXISTS bill_number_seq START WITH 1");
  await queryWith(client, "CREATE SEQUENCE IF NOT EXISTS pos_bill_number_seq START WITH 1");
  await queryWith(client, "ALTER TABLE IF EXISTS bills ADD COLUMN IF NOT EXISTS source_type VARCHAR(30) NOT NULL DEFAULT 'order'");
  await queryWith(client, "ALTER TABLE IF EXISTS bills ADD COLUMN IF NOT EXISTS source_id INTEGER");
  await queryWith(client, "ALTER TABLE IF EXISTS bills ADD COLUMN IF NOT EXISTS order_number VARCHAR(80)");
  await queryWith(client, "ALTER TABLE IF EXISTS bills ADD COLUMN IF NOT EXISTS token_number INTEGER");
  await queryWith(client, "ALTER TABLE IF EXISTS bills ADD COLUMN IF NOT EXISTS table_number VARCHAR(50)");
  await queryWith(client, "ALTER TABLE IF EXISTS bills ADD COLUMN IF NOT EXISTS order_type VARCHAR(30)");
  await queryWith(client, "ALTER TABLE IF EXISTS bills ADD COLUMN IF NOT EXISTS order_source VARCHAR(40)");
  await queryWith(client, "ALTER TABLE IF EXISTS bills ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP");
  await queryWith(client, "ALTER TABLE IF EXISTS bills ADD COLUMN IF NOT EXISTS paid_by INTEGER");
  await queryWith(client, "ALTER TABLE IF EXISTS bills ADD COLUMN IF NOT EXISTS settled_by INTEGER");
  await queryWith(client, "ALTER TABLE IF EXISTS bills ADD COLUMN IF NOT EXISTS receipt_settings JSONB DEFAULT '{}'::jsonb NOT NULL");
  await queryWith(client, "UPDATE bills SET source_type = 'order', source_id = order_id WHERE source_id IS NULL AND order_id IS NOT NULL");
  await queryWith(client, "CREATE INDEX IF NOT EXISTS idx_bills_source ON bills(source_type, source_id)");
  await queryWith(client, "CREATE INDEX IF NOT EXISTS idx_bills_payment_status ON bills(payment_status)");
  await queryWith(client, "ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS source_type VARCHAR(30) NOT NULL DEFAULT 'order'");
  await queryWith(client, "ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS source_id BIGINT");
  await queryWith(client, "UPDATE payments SET source_type = 'order', source_id = order_id WHERE source_id IS NULL AND order_id IS NOT NULL");
  await queryWith(client, "ALTER TABLE IF EXISTS payments ALTER COLUMN order_id DROP NOT NULL");
  await queryWith(client, "CREATE INDEX IF NOT EXISTS idx_payments_source ON payments(source_type, source_id)");
  await queryWith(client, "CREATE INDEX IF NOT EXISTS idx_payments_status_method ON payments(payment_status, payment_method)");
  await queryWith(client, `
    CREATE TABLE IF NOT EXISTS billing_audit_events (
      id BIGSERIAL PRIMARY KEY,
      bill_id INTEGER,
      source_type VARCHAR(30),
      source_id BIGINT,
      action VARCHAR(80) NOT NULL,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_by INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await queryWith(client, "CREATE INDEX IF NOT EXISTS idx_billing_audit_events_bill ON billing_audit_events(bill_id)");
  await queryWith(client, "CREATE INDEX IF NOT EXISTS idx_billing_audit_events_action ON billing_audit_events(action, created_at)");
  await queryWith(client, `
    CREATE TABLE IF NOT EXISTS end_of_day_settlements (
      id BIGSERIAL PRIMARY KEY,
      business_date DATE NOT NULL UNIQUE,
      opened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      closed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      cash_collected NUMERIC(12, 2) NOT NULL DEFAULT 0,
      upi_collected NUMERIC(12, 2) NOT NULL DEFAULT 0,
      card_collected NUMERIC(12, 2) NOT NULL DEFAULT 0,
      total_paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
      unpaid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
      refunds NUMERIC(12, 2) NOT NULL DEFAULT 0,
      pos_revenue NUMERIC(12, 2) NOT NULL DEFAULT 0,
      restaurant_order_revenue NUMERIC(12, 2) NOT NULL DEFAULT 0,
      combined_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
      expected_cash NUMERIC(12, 2) NOT NULL DEFAULT 0,
      actual_cash NUMERIC(12, 2) NOT NULL DEFAULT 0,
      cash_difference NUMERIC(12, 2) NOT NULL DEFAULT 0,
      summary_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
      closed_by INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await queryWith(client, "CREATE INDEX IF NOT EXISTS idx_end_of_day_settlements_closed_at ON end_of_day_settlements(closed_at DESC)");
}

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

function moneyMatches(left, right) {
  return Math.abs(money(left) - money(right)) <= 0.01;
}

function billYear() {
  return new Date().getFullYear();
}

async function generateSequencedBillNumber(client, sequenceName, prefix) {
  await ensureBillingSchema(client);
  const result = await queryWith(client, `SELECT nextval('${sequenceName}') AS value`);
  return `${prefix}-${billYear()}-${String(result.rows[0].value).padStart(6, "0")}`;
}

export async function generateBillNumber(client) {
  return generateSequencedBillNumber(client, "bill_number_seq", BILL_PREFIX);
}

export async function generatePosBillNumber(client) {
  return generateSequencedBillNumber(client, "pos_bill_number_seq", POS_BILL_PREFIX);
}

export function normalizeStaffPaymentMethod(value) {
  const normalized = String(value || "cash").trim().toLowerCase().replace(/\s+/g, "_");
  const lookupKey = normalized === "pay_at_counter" ? "pay_at_counter" : normalized;
  const label = paymentMethodLabels.get(lookupKey) || paymentMethodLabels.get(String(value || "").trim().toLowerCase());

  if (!label || !["Cash", "UPI", "Card", "Pay at Counter"].includes(label)) {
    const error = new Error("Payment method must be Cash, UPI, Card, or Pay at Counter");
    error.statusCode = 400;
    throw error;
  }

  return { code: lookupKey, label };
}

export async function getReceiptSettings(client = pool) {
  await queryWith(client, `
    CREATE TABLE IF NOT EXISTS app_settings (
      key VARCHAR(80) PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_by INT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const result = await queryWith(client, "SELECT value FROM app_settings WHERE key = $1", [SETTINGS_KEY]);
  const saved = result.rows[0]?.value || {};

  return {
    restaurant_name: String(saved.restaurantName || defaultReceiptSettings.restaurantName).trim(),
    address: String(saved.address || defaultReceiptSettings.address).trim(),
    phone: String(saved.phone || defaultReceiptSettings.phone).trim(),
    gstin: String(saved.gst || "").trim(),
    footer_text: String(saved.footerText || defaultReceiptSettings.footerText).trim(),
    receipt_width: ["58", "80"].includes(String(saved.receiptWidth || "").trim())
      ? String(saved.receiptWidth).trim()
      : defaultReceiptSettings.receiptWidth,
    auto_open_after_payment: String(saved.autoOpenReceiptAfterPayment || "").toLowerCase() === "true",
  };
}

export async function recordBillingEvent(
  client,
  { billId = null, sourceType = null, sourceId = null, action, details = {}, createdBy = null } = {}
) {
  await ensureBillingSchema(client);
  if (!action) return null;

  const result = await queryWith(
    client,
    `INSERT INTO billing_audit_events (bill_id, source_type, source_id, action, details, created_by)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)
     RETURNING *`,
    [
      billId,
      sourceType,
      sourceId,
      action,
      JSON.stringify(details || {}),
      createdBy,
    ]
  );

  return result.rows[0];
}

export async function createBillForOrder(client, { orderId, billType = "order", createdBy = null } = {}) {
  await ensureBillingSchema(client);

  const existingBill = await queryWith(client, "SELECT * FROM bills WHERE order_id = $1", [orderId]);
  if (
    existingBill.rowCount > 0 &&
    String(existingBill.rows[0].payment_status || "").toLowerCase() === "paid"
  ) {
    return existingBill.rows[0];
  }

  const orderResult = await queryWith(
    client,
    `SELECT o.id, o.order_number, o.subtotal, o.tax, o.delivery_charge, o.discount,
            o.total_amount, o.payment_method, o.payment_status, o.paid_at,
            o.table_number, o.order_type, o.order_source, o.token_number,
            COALESCE(o.customer_name, c.name) AS customer_name,
            COALESCE(o.customer_phone, c.phone) AS customer_phone
     FROM orders o
     JOIN customers c ON c.id = o.customer_id
     WHERE o.id = $1`,
    [orderId]
  );

  if (orderResult.rowCount === 0) {
    const error = new Error("Order not found for billing");
    error.statusCode = 404;
    throw error;
  }

  const itemsResult = await queryWith(
    client,
    `SELECT oi.menu_id, m.name, oi.quantity, oi.unit_price, oi.total_price
     FROM order_items oi
     JOIN menu m ON m.id = oi.menu_id
     WHERE oi.order_id = $1
     ORDER BY oi.id ASC`,
    [orderId]
  );

  const order = orderResult.rows[0];
  const billNumber = await generateBillNumber(client);
  const receiptSettings = await getReceiptSettings(client);
  const lineItems = itemsResult.rows.map((item) => ({
    menu_id: Number(item.menu_id),
    name: item.name,
    quantity: Number(item.quantity),
    unit_price: Number(item.unit_price),
    total_price: Number(item.total_price),
  }));

  const billResult = await queryWith(
    client,
    `INSERT INTO bills (
       order_id, source_type, source_id, bill_number, bill_type, order_number,
       token_number, table_number, order_type, order_source, customer_name, customer_phone, line_items,
       subtotal, tax, delivery_charge, discount, total_amount, payment_method,
       payment_status, paid_at, paid_by, receipt_settings, created_by
     )
     VALUES ($1, 'order', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb,
             $12, $13, $14, $15, $16, $17, $18, $19, $20, $21::jsonb, $22)
     ON CONFLICT (order_id)
     DO UPDATE SET
       order_number = EXCLUDED.order_number,
       token_number = EXCLUDED.token_number,
       table_number = EXCLUDED.table_number,
       order_type = EXCLUDED.order_type,
       order_source = EXCLUDED.order_source,
       customer_name = EXCLUDED.customer_name,
       customer_phone = EXCLUDED.customer_phone,
       line_items = EXCLUDED.line_items,
       subtotal = EXCLUDED.subtotal,
       tax = EXCLUDED.tax,
       delivery_charge = EXCLUDED.delivery_charge,
       discount = EXCLUDED.discount,
       total_amount = EXCLUDED.total_amount,
       payment_method = EXCLUDED.payment_method,
       payment_status = EXCLUDED.payment_status,
       paid_at = EXCLUDED.paid_at,
       paid_by = CASE
         WHEN LOWER(COALESCE(EXCLUDED.payment_status, '')) = 'paid'
         THEN COALESCE(bills.paid_by, EXCLUDED.paid_by)
         ELSE bills.paid_by
       END,
       receipt_settings = CASE
         WHEN bills.receipt_settings = '{}'::jsonb THEN EXCLUDED.receipt_settings
         ELSE bills.receipt_settings
       END,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [
      order.id,
      billNumber,
      billType,
      order.order_number,
      order.token_number,
      order.table_number,
      order.order_type,
      order.order_source,
      order.customer_name,
      order.customer_phone,
      JSON.stringify(lineItems),
      order.subtotal,
      order.tax,
      order.delivery_charge,
      order.discount,
      order.total_amount,
      order.payment_method,
      order.payment_status,
      order.paid_at,
      String(order.payment_status || "").toLowerCase() === "paid" ? createdBy : null,
      JSON.stringify(receiptSettings),
      createdBy,
    ]
  );

  const bill = billResult.rows[0];
  if (existingBill.rowCount === 0) {
    await recordBillingEvent(client, {
      billId: bill.id,
      sourceType: "order",
      sourceId: order.id,
      action: "bill_generated",
      details: { bill_number: bill.bill_number, bill_type: billType, total_amount: money(bill.total_amount) },
      createdBy,
    });
  }

  return bill;
}

export async function getBillByOrderId(client, orderId) {
  await ensureBillingSchema(client);

  const result = await queryWith(client, "SELECT * FROM bills WHERE order_id = $1", [orderId]);
  return result.rows[0] || null;
}

function mapLineItems(items = []) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    name: item.name,
    quantity: Number(item.quantity || 0),
    unit_price: money(item.unit_price ?? item.price),
    total_price: money(item.total_price ?? item.line_total ?? Number(item.quantity || 0) * Number(item.unit_price ?? item.price ?? 0)),
    barcode: item.barcode || null,
  }));
}

function mapReceiptTotals(row) {
  return receiptTotalsFromRow(row);
}

export async function getOrderReceipt(client, orderIdOrBillId, { lookup = "order" } = {}) {
  await ensureBillingSchema(client);
  const id = Number(orderIdOrBillId);
  const whereSql = lookup === "bill" ? "b.id = $1" : "b.order_id = $1";
  const result = await queryWith(
    client,
    `SELECT b.*, o.order_number AS live_order_number, o.status AS order_status,
            o.order_type AS live_order_type, o.order_source AS live_order_source,
            o.table_number AS live_table_number, o.token_number,
            COALESCE(o.customer_name, c.name, b.customer_name) AS live_customer_name,
            COALESCE(o.customer_phone, c.phone, b.customer_phone) AS live_customer_phone
     FROM bills b
     JOIN orders o ON o.id = b.order_id
     LEFT JOIN customers c ON c.id = o.customer_id
     WHERE ${whereSql}
     LIMIT 1`,
    [id]
  );

  if (result.rowCount === 0) {
    const error = new Error("Bill not found");
    error.statusCode = 404;
    throw error;
  }

  const bill = result.rows[0];
  const settings = { ...(await getReceiptSettings(client)), ...(bill.receipt_settings || {}) };

  return {
    id: bill.id,
    source_type: "order",
    source_id: Number(bill.order_id),
    bill_number: bill.bill_number,
    order_number: bill.order_number || bill.live_order_number,
    token_number: bill.token_number || null,
    table_number: bill.table_number || bill.live_table_number || null,
    order_type: bill.order_type || bill.live_order_type || null,
    order_source: bill.order_source || bill.live_order_source || null,
    order_status: bill.order_status || null,
    customer_name: bill.customer_name || bill.live_customer_name || "",
    customer_phone: bill.customer_phone || bill.live_customer_phone || "",
    payment_method: bill.payment_method || "Pay at Counter",
    payment_status: bill.payment_status || "Pending",
    paid_at: bill.paid_at || null,
    created_at: bill.created_at,
    updated_at: bill.updated_at,
    items: mapLineItems(bill.line_items),
    totals: mapReceiptTotals(bill),
    restaurant: settings,
  };
}

export async function getCounterSaleReceipt(client, saleIdOrBillNumber) {
  await ensureBillingSchema(client);
  const rawLookup = String(saleIdOrBillNumber || "").trim();
  const numericLookup = Number(rawLookup);
  const lookupById = Number.isInteger(numericLookup) && numericLookup > 0;
  const saleResult = await queryWith(
    client,
    `SELECT cs.id, cs.bill_number, cs.customer_name, cs.customer_phone,
            cs.payment_method, cs.subtotal, cs.gst_amount, cs.total_amount, cs.created_at,
            p.payment_status, p.paid_at, p.transaction_id
     FROM counter_sales cs
     LEFT JOIN payments p
       ON p.source_type = 'counter_sale'
      AND p.source_id = cs.id
     WHERE ${lookupById ? "cs.id = $1" : "cs.bill_number = $1"}
     ORDER BY p.id DESC
     LIMIT 1`,
    [lookupById ? numericLookup : rawLookup]
  );

  if (saleResult.rowCount === 0) {
    const error = new Error("Counter sale bill not found");
    error.statusCode = 404;
    throw error;
  }

  const sale = saleResult.rows[0];
  const itemsResult = await queryWith(
    client,
    `SELECT p.name, p.barcode, csi.quantity, csi.unit_price, csi.line_total
     FROM counter_sale_items csi
     JOIN products p ON p.id = csi.product_id
     WHERE csi.sale_id = $1
     ORDER BY csi.id ASC`,
    [sale.id]
  );

  return {
    id: Number(sale.id),
    source_type: "counter_sale",
    source_id: Number(sale.id),
    bill_number: sale.bill_number,
    order_number: `POS-${sale.id}`,
    token_number: null,
    table_number: null,
    order_type: "counter_sale",
    order_source: "pos",
    order_status: "Completed",
    customer_name: sale.customer_name || "Counter Customer",
    customer_phone: sale.customer_phone || "",
    payment_method: sale.payment_method || "Cash",
    payment_status: sale.payment_status ? String(sale.payment_status).replace(/^paid$/i, "Paid") : "Paid",
    paid_at: sale.paid_at || sale.created_at,
    created_at: sale.created_at,
    updated_at: sale.created_at,
    items: mapLineItems(itemsResult.rows.map((item) => ({
      ...item,
      total_price: item.line_total,
    }))),
    totals: mapReceiptTotals({
      subtotal: sale.subtotal,
      tax: sale.gst_amount,
      delivery_charge: 0,
      discount: 0,
      total_amount: sale.total_amount,
    }),
    restaurant: await getReceiptSettings(client),
  };
}

export async function getReceipt(client, sourceType, id) {
  const source = String(sourceType || "order").trim().toLowerCase();
  if (source === "order" || source === "restaurant_order") return getOrderReceipt(client, id);
  if (source === "pos" || source === "counter_sale") return getCounterSaleReceipt(client, id);

  const error = new Error("Receipt source must be order or counter_sale");
  error.statusCode = 400;
  throw error;
}

export async function listBills(client = pool, filters = {}) {
  await ensureBillingSchema(client);
  const where = [];
  const posWhere = [];
  const params = [];

  if (filters.today === "true" || filters.range === "today") {
    where.push("b.created_at >= CURRENT_DATE");
    posWhere.push("cs.created_at >= CURRENT_DATE");
  }

  if (filters.status) {
    params.push(String(filters.status));
    where.push(`LOWER(COALESCE(b.payment_status, o.payment_status, 'Pending')) = LOWER($${params.length})`);
    posWhere.push(`LOWER(COALESCE(NULLIF(p.payment_status, ''), 'Paid')) = LOWER($${params.length})`);
  }

  if (filters.method) {
    params.push(String(filters.method));
    where.push(`LOWER(COALESCE(b.payment_method, o.payment_method, '')) LIKE LOWER('%' || $${params.length} || '%')`);
    posWhere.push(`LOWER(COALESCE(cs.payment_method, '')) LIKE LOWER('%' || $${params.length} || '%')`);
  }

  if (filters.search) {
    params.push(String(filters.search).trim());
    const param = `$${params.length}`;
    where.push(`(
      b.bill_number ILIKE '%' || ${param} || '%'
      OR COALESCE(b.order_number, o.order_number) ILIKE '%' || ${param} || '%'
      OR COALESCE(b.customer_name, o.customer_name, c.name, '') ILIKE '%' || ${param} || '%'
      OR COALESCE(b.customer_phone, o.customer_phone, c.phone, '') ILIKE '%' || ${param} || '%'
      OR COALESCE(b.table_number, o.table_number, '') ILIKE '%' || ${param} || '%'
    )`);
    posWhere.push(`(
      cs.bill_number ILIKE '%' || ${param} || '%'
      OR CONCAT('POS-', cs.id) ILIKE '%' || ${param} || '%'
      OR COALESCE(cs.customer_name, '') ILIKE '%' || ${param} || '%'
      OR COALESCE(cs.customer_phone, '') ILIKE '%' || ${param} || '%'
    )`);
  }

  const limit = Math.min(Math.max(Number(filters.limit || 100), 1), 200);
  params.push(limit);

  const result = await queryWith(
    client,
    `WITH unified_bills AS (
       SELECT
         'order' AS source_type,
         b.order_id::text AS source_id,
         b.id AS bill_id,
         b.bill_number,
         COALESCE(b.order_number, o.order_number) AS order_number,
         COALESCE(b.customer_name, o.customer_name, c.name) AS customer_name,
         COALESCE(b.customer_phone, o.customer_phone, c.phone) AS customer_phone,
         COALESCE(b.table_number, o.table_number) AS table_number,
         COALESCE(b.payment_method, o.payment_method) AS payment_method,
         COALESCE(b.payment_status, o.payment_status, 'Pending') AS payment_status,
         COALESCE(b.total_amount, o.total_amount, 0) AS total_amount,
         b.created_at
       FROM bills b
       JOIN orders o ON o.id = b.order_id
       LEFT JOIN customers c ON c.id = o.customer_id
       WHERE COALESCE(o.status, '') <> 'Cancelled'
         ${where.length ? `AND ${where.join(" AND ")}` : ""}

       UNION ALL

       SELECT
         'counter_sale' AS source_type,
         cs.id::text AS source_id,
         NULL::int AS bill_id,
         cs.bill_number,
         CONCAT('POS-', cs.id) AS order_number,
         cs.customer_name,
         cs.customer_phone,
         NULL::varchar AS table_number,
         cs.payment_method,
         COALESCE(NULLIF(p.payment_status, ''), 'Paid') AS payment_status,
         cs.total_amount,
         cs.created_at
       FROM counter_sales cs
       LEFT JOIN LATERAL (
         SELECT payment_status
         FROM payments
         WHERE source_type = 'counter_sale'
           AND source_id = cs.id
         ORDER BY id DESC
         LIMIT 1
       ) p ON TRUE
       ${posWhere.length ? `WHERE ${posWhere.join(" AND ")}` : ""}
     )
     SELECT *
     FROM unified_bills
     ORDER BY created_at DESC, source_id DESC
     LIMIT $${params.length}`,
    params
  );

  return result.rows.map((row) => ({
    ...row,
    total_amount: money(row.total_amount),
  }));
}

export async function getTableDues(client = pool) {
  await ensureBillingSchema(client);
  const result = await queryWith(client, `
    SELECT
      o.table_id,
      o.table_number,
      COUNT(*)::int AS active_orders,
      COALESCE(SUM(o.total_amount), 0) AS total_due,
      json_agg(
        json_build_object(
          'id', o.id,
          'order_number', o.order_number,
          'token_number', o.token_number,
          'status', o.status,
          'payment_status', o.payment_status,
          'total_amount', o.total_amount,
          'created_at', o.created_at
        )
        ORDER BY o.created_at ASC
      ) AS orders
    FROM orders o
    WHERE o.table_id IS NOT NULL
      AND COALESCE(o.status, '') <> 'Cancelled'
      AND COALESCE(o.payment_status, 'Pending') <> 'Paid'
    GROUP BY o.table_id, o.table_number
    ORDER BY regexp_replace(o.table_number::text, '\\D', '', 'g')::int NULLS LAST, o.table_number
  `);

  return result.rows.map((row) => ({
    table_id: Number(row.table_id),
    table_number: row.table_number,
    active_orders: Number(row.active_orders || 0),
    total_due: money(row.total_due),
    orders: (row.orders || []).map((order) => ({
      ...order,
      total_amount: money(order.total_amount),
    })),
  }));
}

async function upsertPaidPayment(client, {
  order,
  sourceType = "order",
  sourceId,
  customerId = null,
  paymentMethod,
  amount,
  transactionId,
}) {
  const existing = await queryWith(
    client,
    `SELECT id, payment_status, transaction_id
     FROM payments
     WHERE source_type = $1
       AND source_id = $2
       AND LOWER(payment_status) = 'paid'
     ORDER BY id ASC
     LIMIT 1`,
    [sourceType, sourceId]
  );

  if (existing.rowCount > 0) return existing.rows[0];

  const pending = await queryWith(
    client,
    `UPDATE payments
     SET payment_method = $1,
         amount = $2,
         gateway = 'offline',
         payment_status = 'paid',
         transaction_id = COALESCE(transaction_id, $3),
         paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP,
         source_type = $4,
         source_id = $5
     WHERE id = (
       SELECT id
       FROM payments
       WHERE (source_type = $4 AND source_id = $5)
          OR ($4 = 'order' AND order_id = $6)
       ORDER BY id ASC
       LIMIT 1
     )
     RETURNING *`,
    [paymentMethod, amount, transactionId, sourceType, sourceId, order?.id || null]
  );

  if (pending.rowCount > 0) return pending.rows[0];

  const inserted = await queryWith(
    client,
    `INSERT INTO payments (
       order_id, customer_id, gateway, payment_method, amount, currency,
       payment_status, transaction_id, paid_at, source_type, source_id
     )
     VALUES ($1, $2, 'offline', $3, $4, 'INR', 'paid', $5, CURRENT_TIMESTAMP, $6, $7)
     RETURNING *`,
    [order?.id || null, customerId, paymentMethod, amount, transactionId, sourceType, sourceId]
  );

  return inserted.rows[0];
}

export async function payOrder(client, {
  orderId,
  paymentMethod = "Cash",
  expectedTotal,
  createdBy = null,
} = {}) {
  await ensureBillingSchema(client);
  const method = normalizeStaffPaymentMethod(paymentMethod);
  const orderResult = await queryWith(
    client,
    `SELECT *
     FROM orders
     WHERE id = $1
     FOR UPDATE`,
    [orderId]
  );

  if (orderResult.rowCount === 0) {
    const error = new Error("Order not found");
    error.statusCode = 404;
    throw error;
  }

  const order = orderResult.rows[0];
  if (order.status === "Cancelled") {
    const error = new Error("Cancelled orders cannot be settled as normal sales");
    error.statusCode = 409;
    throw error;
  }

  if (expectedTotal !== undefined && expectedTotal !== null && !moneyMatches(expectedTotal, order.total_amount)) {
    const error = new Error("Confirmed amount does not match the order total");
    error.statusCode = 409;
    throw error;
  }

  if (String(order.payment_status || "").toLowerCase() === "paid") {
    const bill = await createBillForOrder(client, { orderId, createdBy });
    return { alreadyPaid: true, order, bill, payment: null };
  }

  const transactionId = `offline-${orderId}-${Date.now()}`;
  const payment = await upsertPaidPayment(client, {
    order,
    sourceType: "order",
    sourceId: order.id,
    customerId: order.customer_id,
    paymentMethod: method.code,
    amount: money(order.total_amount),
    transactionId,
  });

  const updatedOrder = await queryWith(
    client,
    `UPDATE orders
     SET payment_status = 'Paid',
         payment_method = $1,
         transaction_id = COALESCE(transaction_id, $2),
         paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3
     RETURNING *`,
    [method.label, payment.transaction_id || transactionId, order.id]
  );

  const bill = await createBillForOrder(client, {
    orderId,
    billType: "offline",
    createdBy,
  });

  await queryWith(
    client,
    `UPDATE bills
     SET paid_by = COALESCE(paid_by, $1),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [createdBy, bill.id]
  );
  await recordBillingEvent(client, {
    billId: bill.id,
    sourceType: "order",
    sourceId: order.id,
    action: "payment_marked_paid",
    details: {
      payment_method: method.label,
      amount: money(order.total_amount),
      transaction_id: payment.transaction_id || transactionId,
    },
    createdBy,
  });

  return { alreadyPaid: false, order: updatedOrder.rows[0], bill, payment };
}

export async function settleTable(client, {
  tableId,
  tableNumber,
  paymentMethod = "Cash",
  expectedTotal,
  createdBy = null,
} = {}) {
  await ensureBillingSchema(client);
  const method = normalizeStaffPaymentMethod(paymentMethod);
  const params = [];
  let tableSql = "";

  if (Number.isInteger(Number(tableId)) && Number(tableId) > 0) {
    params.push(Number(tableId));
    tableSql = "o.table_id = $1";
  } else if (tableNumber) {
    params.push(String(tableNumber));
    tableSql = "o.table_number = $1";
  } else {
    const error = new Error("Table ID or table number is required");
    error.statusCode = 400;
    throw error;
  }

  const ordersResult = await queryWith(
    client,
    `SELECT o.*
     FROM orders o
     WHERE ${tableSql}
       AND COALESCE(o.status, '') <> 'Cancelled'
       AND COALESCE(o.payment_status, 'Pending') <> 'Paid'
     ORDER BY o.created_at ASC
     FOR UPDATE`,
    params
  );

  if (ordersResult.rowCount === 0) {
    const error = new Error("No unpaid orders found for this table");
    error.statusCode = 404;
    throw error;
  }

  const totalDue = money(ordersResult.rows.reduce((sum, order) => sum + Number(order.total_amount || 0), 0));
  if (expectedTotal !== undefined && expectedTotal !== null && !moneyMatches(expectedTotal, totalDue)) {
    const error = new Error("Confirmed amount does not match the table due total");
    error.statusCode = 409;
    throw error;
  }

  const settled = [];
  for (const order of ordersResult.rows) {
    const result = await payOrder(client, {
      orderId: Number(order.id),
      paymentMethod: method.code,
      expectedTotal: order.total_amount,
      createdBy,
    });
    settled.push(result);
  }

  await recordBillingEvent(client, {
    sourceType: "table",
    sourceId: ordersResult.rows[0].table_id,
    action: "table_settled",
    details: {
      table_id: ordersResult.rows[0].table_id,
      table_number: ordersResult.rows[0].table_number,
      payment_method: method.label,
      total_paid: totalDue,
      order_ids: ordersResult.rows.map((order) => Number(order.id)),
    },
    createdBy,
  });

  return {
    table_id: ordersResult.rows[0].table_id,
    table_number: ordersResult.rows[0].table_number,
    payment_method: method.label,
    total_paid: totalDue,
    orders: settled.map((entry) => ({
      id: entry.order.id,
      order_number: entry.order.order_number,
      bill_number: entry.bill?.bill_number,
      total_amount: money(entry.order.total_amount),
    })),
  };
}

function normalizeBusinessDate(value) {
  const text = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return new Date().toISOString().slice(0, 10);
}

export async function getEndOfDaySummary(client = pool, { date } = {}) {
  await ensureBillingSchema(client);
  const businessDate = normalizeBusinessDate(date);
  const result = await queryWith(client, `
    WITH paid_payments AS (
      SELECT
        LOWER(COALESCE(payment_method, '')) AS method,
        COALESCE(source_type, 'order') AS source_type,
        COALESCE(amount, 0) AS amount
      FROM payments
      WHERE LOWER(payment_status) IN ('paid', 'captured')
        AND COALESCE(paid_at, created_at) >= $1::date
        AND COALESCE(paid_at, created_at) < ($1::date + INTERVAL '1 day')
    ),
    refunded_payments AS (
      SELECT COALESCE(SUM(amount), 0) AS amount
      FROM payments
      WHERE LOWER(payment_status) = 'refunded'
        AND COALESCE(refunded_at, updated_at, created_at) >= $1::date
        AND COALESCE(refunded_at, updated_at, created_at) < ($1::date + INTERVAL '1 day')
    ),
    unpaid_orders AS (
      SELECT COALESCE(SUM(total_amount), 0) AS total, COUNT(*)::int AS count
      FROM orders
      WHERE COALESCE(status, '') <> 'Cancelled'
        AND COALESCE(payment_status, 'Pending') <> 'Paid'
        AND created_at >= $1::date
        AND created_at < ($1::date + INTERVAL '1 day')
    )
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE method IN ('cash', 'cash_on_delivery')), 0) AS cash_sales,
      COALESCE(SUM(amount) FILTER (WHERE method = 'upi'), 0) AS upi_sales,
      COALESCE(SUM(amount) FILTER (WHERE method = 'card'), 0) AS card_sales,
      COALESCE(SUM(amount) FILTER (WHERE method = 'pay_at_counter'), 0) AS pay_at_counter_sales,
      COALESCE(SUM(amount) FILTER (WHERE source_type = 'counter_sale'), 0) AS pos_revenue,
      COALESCE(SUM(amount) FILTER (WHERE source_type = 'order'), 0) AS restaurant_order_revenue,
      COALESCE(SUM(amount), 0) AS total_collected,
      (SELECT total FROM unpaid_orders) AS unpaid_total,
      (SELECT count FROM unpaid_orders) AS unpaid_orders,
      (SELECT amount FROM refunded_payments) AS refunds
    FROM paid_payments
  `, [businessDate]);

  const row = result.rows[0] || {};
  const cashSales = money(row.cash_sales);
  const totalCollected = money(row.total_collected);
  const refunds = money(row.refunds);
  const posRevenue = money(row.pos_revenue);
  const restaurantOrderRevenue = money(row.restaurant_order_revenue);
  return {
    business_date: businessDate,
    cash_sales: cashSales,
    cash_collected: cashSales,
    upi_sales: money(row.upi_sales),
    upi_collected: money(row.upi_sales),
    card_sales: money(row.card_sales),
    card_collected: money(row.card_sales),
    pay_at_counter_sales: money(row.pay_at_counter_sales),
    total_collected: totalCollected,
    total_paid: totalCollected,
    unpaid_total: money(row.unpaid_total),
    unpaid_amount: money(row.unpaid_total),
    unpaid_orders: Number(row.unpaid_orders || 0),
    refunds,
    pos_revenue: posRevenue,
    restaurant_order_revenue: restaurantOrderRevenue,
    combined_total: money(posRevenue + restaurantOrderRevenue),
    expected_cash: cashSales,
  };
}

export async function closeEndOfDay(client, { date, actualCash = 0, closedBy = null } = {}) {
  await ensureBillingSchema(client);
  const businessDate = normalizeBusinessDate(date);
  const existing = await queryWith(
    client,
    "SELECT * FROM end_of_day_settlements WHERE business_date = $1 LIMIT 1",
    [businessDate]
  );

  if (existing.rowCount > 0) {
    return { alreadyClosed: true, settlement: existing.rows[0] };
  }

  const summary = await getEndOfDaySummary(client, { date: businessDate });
  const actual = money(actualCash);
  const expected = money(summary.expected_cash);
  const difference = money(actual - expected);
  const result = await queryWith(
    client,
    `INSERT INTO end_of_day_settlements (
       business_date, cash_collected, upi_collected, card_collected, total_paid,
       unpaid_amount, refunds, pos_revenue, restaurant_order_revenue, combined_total,
       expected_cash, actual_cash, cash_difference, summary_snapshot, closed_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15)
     RETURNING *`,
    [
      businessDate,
      summary.cash_collected,
      summary.upi_collected,
      summary.card_collected,
      summary.total_paid,
      summary.unpaid_amount,
      summary.refunds,
      summary.pos_revenue,
      summary.restaurant_order_revenue,
      summary.combined_total,
      expected,
      actual,
      difference,
      JSON.stringify(summary),
      closedBy,
    ]
  );

  await recordBillingEvent(client, {
    action: "end_of_day_closed",
    details: { business_date: businessDate, expected_cash: expected, actual_cash: actual, cash_difference: difference },
    createdBy: closedBy,
  });

  return { alreadyClosed: false, settlement: result.rows[0] };
}

export async function getSettlementHistory(client = pool, { limit = 30 } = {}) {
  await ensureBillingSchema(client);
  const safeLimit = Math.min(Math.max(Number(limit || 30), 1), 100);
  const result = await queryWith(
    client,
    `SELECT *
     FROM end_of_day_settlements
     ORDER BY business_date DESC, id DESC
     LIMIT $1`,
    [safeLimit]
  );

  return result.rows.map((row) => ({
    ...row,
    cash_collected: money(row.cash_collected),
    upi_collected: money(row.upi_collected),
    card_collected: money(row.card_collected),
    total_paid: money(row.total_paid),
    unpaid_amount: money(row.unpaid_amount),
    refunds: money(row.refunds),
    pos_revenue: money(row.pos_revenue),
    restaurant_order_revenue: money(row.restaurant_order_revenue),
    combined_total: money(row.combined_total),
    expected_cash: money(row.expected_cash),
    actual_cash: money(row.actual_cash),
    cash_difference: money(row.cash_difference),
  }));
}

export async function getTestReceipt(client = pool) {
  await ensureBillingSchema(client);
  const settings = await getReceiptSettings(client);
  const sampleItems = [
    { name: "Printer Test Item", quantity: 1, unit_price: 10, total_price: 10 },
    { name: "Thermal Receipt Check", quantity: 1, unit_price: 5, total_price: 5 },
  ];

  return {
    id: 0,
    source_type: "test",
    source_id: 0,
    bill_number: "TEST-RECEIPT",
    order_number: "No sale created",
    token_number: null,
    table_number: null,
    order_type: "test",
    order_source: "admin",
    order_status: "Test",
    customer_name: "",
    customer_phone: "",
    payment_method: "Cash",
    payment_status: "Unpaid",
    paid_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    items: sampleItems,
    totals: {
      subtotal: 15,
      discount: 0,
      tax: 0,
      cgst: 0,
      sgst: 0,
      cgst_rate: 0.025,
      sgst_rate: 0.025,
      packing: 0,
      grand_total: 15,
    },
    restaurant: settings,
    is_test_receipt: true,
  };
}
