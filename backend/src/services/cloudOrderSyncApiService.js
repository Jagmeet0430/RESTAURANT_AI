import { updateOrderStatusWithHistory, normalizeOrderStatus } from "./orderStatusService.js";
import { createBillForOrder, payOrder } from "./billingService.js";
import { sendOrderStatusNotification } from "./notificationService.js";
import { syncError } from "../config/cloudSyncConfig.js";

const websiteWhere = "order_source IN ('website', 'customer_web') AND cloud_order_id IS NULL";

export async function pendingCloudOrders(db, afterId = 0) {
  const result = await db.query(`
    SELECT o.id AS cloud_order_id, o.order_number, o.status, o.payment_status, o.payment_method,
           o.subtotal, o.tax, o.delivery_charge, o.discount, o.total_amount,
           COALESCE(o.customer_name, c.name) AS customer_name,
           COALESCE(o.customer_phone, c.phone) AS customer_phone, o.phone_verified,
           o.order_type, o.table_number, o.special_instructions, o.delivery_address,
           o.tracking_token, o.cancellation_reason, o.created_at,
           o.paid_at, o.estimated_ready_at, o.actual_delivery_time,
           (SELECT json_agg(json_build_object(
             'menu_id', m.id, 'barcode', m.barcode, 'name', m.name, 'category', cat.name,
             'quantity', oi.quantity, 'unit_price', oi.unit_price, 'total_price', oi.total_price,
             'special_instructions', oi.special_instructions) ORDER BY oi.id)
            FROM order_items oi JOIN menu m ON m.id = oi.menu_id
            JOIN categories cat ON cat.id = m.category_id WHERE oi.order_id = o.id) AS items
    FROM orders o JOIN customers c ON c.id = o.customer_id
    WHERE o.${websiteWhere} AND o.cloud_synced_at IS NULL AND o.id > $1
      AND o.status IN ('Confirmed', 'Accepted', 'Preparing', 'Ready', 'Out for Delivery', 'Completed', 'Cancelled')
      AND (LOWER(COALESCE(o.payment_method, '')) NOT LIKE 'razorpay%' OR o.payment_status = 'Paid')
    ORDER BY o.id LIMIT 50`, [afterId]);
  return result.rows;
}

export async function acknowledgeCloudOrder(db, cloudId, localId) {
  const result = await db.query(`UPDATE orders
    SET cloud_local_order_id = $2, cloud_synced_at = COALESCE(cloud_synced_at, CURRENT_TIMESTAMP),
        cloud_sync_status = 'synced'
    WHERE id = $1 AND ${websiteWhere}
      AND (cloud_local_order_id IS NULL OR cloud_local_order_id = $2)
    RETURNING id`, [cloudId, localId]);
  if (!result.rowCount) throw syncError("SYNC_ACK_CONFLICT");
  return { cloud_order_id: cloudId, local_order_id: localId };
}

export async function applyCloudOrderStatus(db, cloudId, event) {
  const version = Number(event.version), localId = Number(event.local_order_id);
  if (!Number.isSafeInteger(version) || version < 1 || !Number.isSafeInteger(localId) || localId < 1) {
    throw syncError("SYNC_INVALID_EVENT", 400);
  }
  const paymentStatus = String(event.payment_status || "");
  if (!["Pending", "Paid", "Refunded", "Failed"].includes(paymentStatus)) throw syncError("SYNC_INVALID_PAYMENT", 400);
  for (const field of ["paid_at", "estimated_ready_at", "actual_delivery_time"]) {
    if (event[field] != null && (typeof event[field] !== "string" || event[field].length > 40 || !Number.isFinite(Date.parse(event[field])))) {
      throw syncError("SYNC_INVALID_TIMESTAMP", 400);
    }
  }
  if (typeof event.status !== "string" || String(event.cancellation_reason || "").length > 2000) throw syncError("SYNC_INVALID_EVENT", 400);
  const client = await db.connect();
  let updated;
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '3s'");
    await client.query("SET LOCAL statement_timeout = '15s'");
    const result = await client.query(`SELECT * FROM orders WHERE id = $1 AND ${websiteWhere} FOR UPDATE`, [cloudId]);
    const order = result.rows[0];
    if (!order || Number(order.cloud_local_order_id) !== localId) throw syncError("SYNC_ORDER_NOT_ACKNOWLEDGED");
    if (version <= Number(order.cloud_sync_version)) {
      await client.query("COMMIT");
      return { version, duplicate: true };
    }
    if (version !== Number(order.cloud_sync_version) + 1) throw syncError("SYNC_VERSION_GAP");
    // Counter collection uses the existing settlement path, keeping cloud bills
    // and payments consistent. The sync endpoint never invokes a payment gateway.
    if (paymentStatus === "Paid" && order.payment_status !== "Paid") {
      await payOrder(client, { orderId: order.id, paymentMethod: event.payment_method, expectedTotal: order.total_amount });
    } else if (paymentStatus !== order.payment_status) {
      throw syncError("SYNC_PAYMENT_CONFLICT");
    }
    updated = await updateOrderStatusWithHistory({
      orderId: order.id, status: event.status, cancellationReason: event.cancellation_reason,
      client, notify: false,
    });
    await client.query(`UPDATE orders SET cloud_sync_version = $2, cloud_sync_status = 'synced',
      estimated_ready_at = $3, actual_delivery_time = $4,
      paid_at = COALESCE($5, paid_at), cloud_synced_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [order.id, version, event.estimated_ready_at ? new Date(event.estimated_ready_at) : null,
      event.actual_delivery_time ? new Date(event.actual_delivery_time) : null, event.paid_at ? new Date(event.paid_at) : null]);
    await createBillForOrder(client, { orderId: order.id });
    await client.query("COMMIT");
    if (normalizeOrderStatus(order.status) !== normalizeOrderStatus(updated.status)) {
      sendOrderStatusNotification(updated).catch(() => {});
    }
    return { version, duplicate: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
