import { pool } from "../config/database.js";
import { maskPhoneNumber } from "../utils/phoneNumber.js";
import { normalizeOrderStatus } from "./orderStatusService.js";
import { ensureOrderSecuritySchema } from "./orderSchemaService.js";
import { sendWhatsAppMessage } from "./whatsappService.js";

function frontendUrl() {
  return String(process.env.FRONTEND_URL || "http://localhost:5001/customer").replace(/\/$/, "");
}

function trackingUrl(order) {
  return `${frontendUrl()}/track-order/${order.tracking_token}`;
}

export function messageForOrderStatus(order) {
  const status = normalizeOrderStatus(order.status);
  const orderNumber = order.order_number || order.id;
  const customerName = String(order.customer_name || "Customer").split(/\s+/)[0];

  if (status === "confirmed") {
    return `Hello ${customerName}, your order #${orderNumber} has been confirmed. Total: Rs.${Number(order.total_amount || 0).toFixed(0)}. Order type: ${order.order_type || "pickup"}. Track your order here: ${trackingUrl(order)}`;
  }
  if (status === "accepted") return `Your order #${orderNumber} has been accepted by the restaurant.`;
  if (status === "preparing") return `Your order #${orderNumber} is now being prepared.`;
  if (status === "ready") {
    return String(order.order_type || "").toLowerCase() === "delivery"
      ? `Your order #${orderNumber} is ready and will soon be sent for delivery.`
      : `Your order #${orderNumber} is ready for pickup.`;
  }
  if (status === "out_for_delivery") return `Your order #${orderNumber} is out for delivery.`;
  if (status === "completed") return `Your order #${orderNumber} has been completed. Thank you for ordering with us.`;
  if (status === "cancelled") {
    return `Your order #${orderNumber} has been cancelled. Reason: ${order.cancellation_reason || "Not specified"}. For assistance, contact ${process.env.RESTAURANT_PHONE || "the restaurant"}.`;
  }

  return `Your order #${orderNumber} status is ${order.status}.`;
}

async function createNotificationRecord({ order, body, retryOf = null }) {
  const provider = String(process.env.WHATSAPP_PROVIDER || "mock").toLowerCase();
  const status = normalizeOrderStatus(order.status);
  const notificationType = status === "confirmed" ? "order_confirmed" : "order_status";

  if (!retryOf) {
    const existing = await pool.query(
      `SELECT id, delivery_status
       FROM whatsapp_notifications
       WHERE order_id = $1
         AND order_status = $2
         AND notification_type = $3
       LIMIT 1`,
      [order.id, status, notificationType]
    );
    if (existing.rowCount > 0) return { duplicate: true, record: existing.rows[0] };
  }

  const result = await pool.query(
    `INSERT INTO whatsapp_notifications
       (order_id, phone_number, notification_type, order_status, provider, delivery_status, retry_count)
     VALUES ($1, $2, $3, $4, $5, 'queued', $6)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [
      order.id,
      order.customer_phone,
      notificationType,
      status,
      provider,
      retryOf ? Number(retryOf.retry_count || 0) + 1 : 0,
    ]
  );

  return {
    duplicate: result.rowCount === 0,
    record: result.rows[0],
    body,
  };
}

export async function sendOrderStatusNotification(order) {
  await ensureOrderSecuritySchema();
  if (!order.customer_phone || !order.tracking_token) return null;

  const body = messageForOrderStatus(order);
  const recordInfo = await createNotificationRecord({ order, body });
  if (!recordInfo.record || recordInfo.duplicate) return recordInfo.record || null;

  try {
    const response = await sendWhatsAppMessage({ to: order.customer_phone, body });
    const updated = await pool.query(
      `UPDATE whatsapp_notifications
       SET provider_message_id = $1,
           delivery_status = $2,
           sent_at = CURRENT_TIMESTAMP,
           error_message = NULL
       WHERE id = $3
       RETURNING *`,
      [response.providerMessageId, response.deliveryStatus || "sent", recordInfo.record.id]
    );
    return updated.rows[0];
  } catch (error) {
    const updated = await pool.query(
      `UPDATE whatsapp_notifications
       SET delivery_status = $1,
           error_message = $2
       WHERE id = $3
       RETURNING *`,
      [error.temporary ? "retryable_failed" : "failed", error.message, recordInfo.record.id]
    );
    return updated.rows[0];
  }
}

export async function retryWhatsAppNotification(orderId) {
  await ensureOrderSecuritySchema();
  const failed = await pool.query(
    `SELECT *
     FROM whatsapp_notifications
     WHERE order_id = $1
       AND delivery_status IN ('failed', 'retryable_failed')
     ORDER BY created_at DESC
     LIMIT 1`,
    [orderId]
  );

  if (failed.rowCount === 0) {
    const error = new Error("No failed WhatsApp notification found for this order");
    error.statusCode = 404;
    throw error;
  }

  const orderResult = await pool.query(
    `SELECT o.*, COALESCE(o.customer_name, c.name) AS customer_name,
            COALESCE(o.customer_phone, c.phone) AS customer_phone
     FROM orders o
     JOIN customers c ON c.id = o.customer_id
     WHERE o.id = $1`,
    [orderId]
  );

  if (orderResult.rowCount === 0) {
    const error = new Error("Order not found");
    error.statusCode = 404;
    throw error;
  }

  await pool.query("DELETE FROM whatsapp_notifications WHERE id = $1", [failed.rows[0].id]);
  return sendOrderStatusNotification(orderResult.rows[0]);
}

export async function updateWhatsAppDeliveryStatus({ providerMessageId, deliveryStatus, errorMessage = null }) {
  if (!providerMessageId) return null;
  const result = await pool.query(
    `UPDATE whatsapp_notifications
     SET delivery_status = $1,
         delivered_at = CASE WHEN $1 IN ('delivered', 'read') THEN CURRENT_TIMESTAMP ELSE delivered_at END,
         error_message = COALESCE($2, error_message)
     WHERE provider_message_id = $3
     RETURNING id, order_id, delivery_status`,
    [deliveryStatus, errorMessage, providerMessageId]
  );
  return result.rows[0] || null;
}

export function publicNotificationSummary(row) {
  if (!row) return null;
  return {
    status: row.delivery_status,
    provider: row.provider,
    phone: maskPhoneNumber(row.phone_number),
    sentAt: row.sent_at,
    error: row.error_message || null,
  };
}
