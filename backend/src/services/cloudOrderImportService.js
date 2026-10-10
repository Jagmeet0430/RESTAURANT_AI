import { normalizePhoneNumber, phoneLookupCandidates } from "../utils/phoneNumber.js";
import { normalizeOrderStatus, statusForStorage } from "./orderStatusService.js";
import { generateDailyTokenNumber } from "./tableQrService.js";
import { generateTrackingToken } from "../utils/trackingToken.js";
import { deductInventoryForOrder } from "./inventoryStockService.js";
import { createBillForOrder } from "./billingService.js";
import { syncError } from "../config/cloudSyncConfig.js";

const cents = value => {
  if (value == null || value === "" || !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) >= 100000000) {
    throw syncError("SYNC_INVALID_AMOUNT");
  }
  return Math.round(Number(value) * 100);
};

// pg serializes Date objects in the receiving server's timezone for the
// existing timestamp-without-timezone columns, preserving the original instant.
const timestamp = value => value ? new Date(value) : null;

export function validateCloudOrder(order) {
  const id = Number(order?.cloud_order_id);
  if (!Number.isSafeInteger(id) || id < 1) throw syncError("SYNC_INVALID_ID");
  if (!order.order_number || order.order_number.length > 50 || !order.customer_name || order.customer_name.length > 255) {
    throw syncError("SYNC_INVALID_ORDER");
  }
  const status = normalizeOrderStatus(order.status);
  if (!["confirmed", "accepted", "preparing", "ready", "out_for_delivery", "completed", "cancelled"].includes(status)) {
    throw syncError("SYNC_INVALID_STATUS");
  }
  if (!["pickup", "dine_in", "delivery"].includes(order.order_type)) throw syncError("SYNC_INVALID_ORDER_TYPE");
  if (!["Pending", "Paid", "Failed", "Refunded"].includes(order.payment_status) || !order.payment_method || order.payment_method.length > 50) {
    throw syncError("SYNC_INVALID_PAYMENT");
  }
  if (!order.created_at || !Number.isFinite(Date.parse(order.created_at))) throw syncError("SYNC_INVALID_TIMESTAMP");
  if (!Array.isArray(order.items) || !order.items.length || order.items.length > 50) throw syncError("SYNC_INVALID_ITEMS");
  let subtotal = 0;
  for (const item of order.items) {
    if (!Number.isInteger(Number(item.quantity)) || item.quantity < 1 || item.quantity > 100 || !item.name || !item.category) {
      throw syncError("SYNC_INVALID_ITEMS");
    }
    const line = cents(item.unit_price) * Number(item.quantity);
    if (line !== cents(item.total_price)) throw syncError("SYNC_TOTAL_MISMATCH");
    subtotal += line;
  }
  if (subtotal !== cents(order.subtotal) || subtotal + cents(order.tax) + cents(order.delivery_charge) - cents(order.discount) !== cents(order.total_amount)) {
    throw syncError("SYNC_TOTAL_MISMATCH");
  }
  return { id, phone: normalizePhoneNumber(order.customer_phone), status: statusForStorage(status) };
}

async function mapMenuItem(client, item) {
  // Barcodes survive database ID changes. Without one, require a unique exact
  // product/category match; an ID alone is never considered proof of identity.
  const barcode = String(item.barcode || "").trim();
  const result = barcode
    ? await client.query("SELECT id FROM menu WHERE barcode = $1", [barcode])
    : await client.query(`SELECT m.id FROM menu m JOIN categories c ON c.id = m.category_id
        WHERE LOWER(TRIM(m.name)) = LOWER(TRIM($1)) AND LOWER(TRIM(c.name)) = LOWER(TRIM($2))`, [item.name, item.category]);
  if (result.rowCount !== 1) throw syncError(barcode ? "SYNC_BARCODE_MAPPING_FAILED" : "SYNC_MENU_MAPPING_FAILED");
  return result.rows[0].id;
}

export async function importCloudOrder(db, order, origin) {
  const { id, phone, status } = validateCloudOrder(order);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '3s'");
    await client.query("SET LOCAL statement_timeout = '15s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`cloud-order:${id}`]);
    const existing = await client.query("SELECT * FROM orders WHERE cloud_order_id = $1", [id]);
    if (existing.rowCount) {
      if (existing.rows[0].cloud_sync_origin !== origin) throw syncError("SYNC_ORIGIN_CONFLICT");
      await client.query("COMMIT");
      return { order: existing.rows[0], duplicate: true };
    }
    const mappedItems = [];
    for (const item of order.items) mappedItems.push({ ...item, localMenuId: await mapMenuItem(client, item) });
    let tableId = null;
    if (order.table_number) {
      const table = await client.query("SELECT id FROM restaurant_tables WHERE table_number::text = $1", [String(order.table_number)]);
      if (table.rowCount !== 1) throw syncError("SYNC_TABLE_MAPPING_FAILED");
      tableId = table.rows[0].id;
    }
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`cloud-customer:${phone}`]);
    const customers = await client.query(`SELECT id FROM customers WHERE phone = ANY($1::text[])
      ORDER BY (phone = $2) DESC, id ASC LIMIT 1`, [phoneLookupCandidates(phone), phone]);
    let customerId = customers.rows[0]?.id;
    if (!customerId) {
      const customer = await client.query(`INSERT INTO customers(name, phone, country, is_active)
        VALUES ($1, $2, 'India', TRUE) RETURNING id`, [order.customer_name, phone]);
      customerId = customer.rows[0].id;
    }
    const token = await generateDailyTokenNumber(client);
    const result = await client.query(`INSERT INTO orders (
      customer_id, order_number, status, payment_status, payment_method,
      subtotal, tax, delivery_charge, discount, total_amount, customer_name, customer_phone,
      phone_verified, order_type, table_id, table_number, order_source, token_number, token_date,
      tracking_token, special_instructions, delivery_address, created_at, paid_at,
      cancellation_reason, estimated_ready_at, actual_delivery_time,
      cloud_order_id, cloud_sync_origin, cloud_sync_status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'website',$17,$18,
        $19,$20,$21,$22,$23,$24,$25,$26,$27,$28,'pending') RETURNING *`, [
      customerId, order.order_number, status, order.payment_status, order.payment_method,
      order.subtotal, order.tax, order.delivery_charge, order.discount, order.total_amount,
      order.customer_name, phone, order.phone_verified === true, order.order_type, tableId, order.table_number || null,
      token.token_number, token.token_date, order.tracking_token || generateTrackingToken(),
      order.special_instructions || "Source: website", order.delivery_address || null,
      timestamp(order.created_at), timestamp(order.paid_at), order.cancellation_reason || null,
      timestamp(order.estimated_ready_at), timestamp(order.actual_delivery_time), id, origin,
    ]);
    const local = result.rows[0];
    for (const item of mappedItems) {
      await client.query(`INSERT INTO order_items(order_id, menu_id, quantity, unit_price, total_price, special_instructions)
        VALUES ($1,$2,$3,$4,$5,$6)`, [local.id, item.localMenuId, item.quantity, item.unit_price, item.total_price, item.special_instructions || null]);
    }
    if (!["Cancelled", "Completed"].includes(status)) await deductInventoryForOrder(client, local.id);
    await createBillForOrder(client, { orderId: local.id });
    await client.query(`INSERT INTO payments(order_id, customer_id, gateway, payment_method, amount, payment_status,
      source_type, source_id, paid_at, created_at)
      VALUES ($1,$2,'cloud_sync',$3,$4,$5,'order',$1,$6,$7)`,
    [local.id, customerId, String(order.payment_method).slice(0, 30), order.total_amount, order.payment_status.toLowerCase(), timestamp(order.paid_at), timestamp(order.created_at)]);
    await client.query(`INSERT INTO order_status_history(order_id, previous_status, new_status, cancellation_reason, created_at)
      VALUES ($1,NULL,$2,$3,$4)`, [local.id, status, order.cancellation_reason || null, timestamp(order.created_at)]);
    await client.query("COMMIT");
    return { order: local, duplicate: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
