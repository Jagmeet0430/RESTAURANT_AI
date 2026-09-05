import { pool } from "../config/database.js";
import { sendOrderStatusNotification } from "./notificationService.js";

export const statusAliases = {
  pending: "pending_verification",
  Pending: "pending_verification",
  accepted: "accepted",
  Accepted: "accepted",
  preparing: "preparing",
  Preparing: "preparing",
  ready: "ready",
  Ready: "ready",
  delivered: "completed",
  Delivered: "completed",
  completed: "completed",
  Completed: "completed",
  cancelled: "cancelled",
  Cancelled: "cancelled",
  confirmed: "confirmed",
  Confirmed: "confirmed",
  out_for_delivery: "out_for_delivery",
  "Out for Delivery": "out_for_delivery",
  "Out for delivery": "out_for_delivery",
};

export const displayStatus = {
  pending_verification: "Pending",
  confirmed: "Confirmed",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready",
  out_for_delivery: "Out for Delivery",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function normalizeOrderStatus(status) {
  const trimmed = String(status || "").trim();
  return statusAliases[status] || statusAliases[trimmed] || trimmed.toLowerCase().replace(/\s+/g, "_");
}

export function statusForStorage(status) {
  const normalized = normalizeOrderStatus(status);
  return displayStatus[normalized] || status;
}

const pickupFlow = ["confirmed", "accepted", "preparing", "ready", "completed"];
const deliveryFlow = ["confirmed", "accepted", "preparing", "ready", "out_for_delivery", "completed"];

export function assertValidStatusTransition(currentStatus, nextStatus, orderType = "pickup") {
  const current = normalizeOrderStatus(currentStatus);
  const next = normalizeOrderStatus(nextStatus);

  if (!displayStatus[next]) {
    const error = new Error("Invalid order status");
    error.statusCode = 400;
    throw error;
  }

  if (current === next) return next;
  if (current === "cancelled" || current === "completed") {
    const error = new Error(`Cannot move an order from ${current} to ${next}`);
    error.statusCode = 409;
    throw error;
  }
  if (next === "cancelled") return next;
  if (current === "pending_verification" && next === "confirmed") return next;

  const flow = String(orderType).toLowerCase() === "delivery" ? deliveryFlow : pickupFlow;
  if (flow.indexOf(next) === flow.indexOf(current) + 1) return next;

  const error = new Error(`Invalid status transition from ${current} to ${next}`);
  error.statusCode = 409;
  throw error;
}

export async function updateOrderStatusWithHistory({
  orderId,
  status,
  estimatedMinutes = null,
  cancellationReason = null,
  changedBy = null,
  client = pool,
  notify = true,
} = {}) {
  const orderResult = await client.query(
    `SELECT o.*, c.name AS customer_name_fallback, c.phone AS customer_phone_fallback
     FROM orders o
     JOIN customers c ON c.id = o.customer_id
     WHERE o.id = $1
     FOR UPDATE`,
    [orderId]
  );

  if (orderResult.rowCount === 0) {
    const error = new Error("Order not found");
    error.statusCode = 404;
    throw error;
  }

  const order = orderResult.rows[0];
  const nextStatus = assertValidStatusTransition(order.status, status, order.order_type);
  const nextStatusForStorage = statusForStorage(nextStatus);

  if (normalizeOrderStatus(order.status) === nextStatus) {
    return {
      ...order,
      customer_name: order.customer_name || order.customer_name_fallback,
      customer_phone: order.customer_phone || order.customer_phone_fallback,
    };
  }

  if (nextStatus === "cancelled" && !String(cancellationReason || "").trim()) {
    const error = new Error("Cancellation reason is required");
    error.statusCode = 400;
    throw error;
  }

  const estimatedReadyAt = estimatedMinutes
    ? new Date(Date.now() + Number(estimatedMinutes) * 60_000)
    : order.estimated_ready_at;

  const updated = await client.query(
    `UPDATE orders
     SET status = $1,
         cancellation_reason = CASE WHEN $2 = 'Cancelled' THEN $3 ELSE cancellation_reason END,
         estimated_ready_at = COALESCE($4, estimated_ready_at),
         actual_delivery_time = CASE WHEN $2 = 'Completed' THEN CURRENT_TIMESTAMP ELSE actual_delivery_time END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $5
     RETURNING *`,
    [
      nextStatusForStorage,
      nextStatusForStorage,
      cancellationReason || null,
      estimatedReadyAt || null,
      orderId,
    ]
  );

  await client.query(
    `INSERT INTO order_status_history
       (order_id, previous_status, new_status, changed_by, cancellation_reason)
     VALUES ($1, $2, $3, $4, $5)`,
    [orderId, order.status, nextStatusForStorage, changedBy, cancellationReason || null]
  );

  const updatedOrder = {
    ...updated.rows[0],
    customer_name: updated.rows[0].customer_name || order.customer_name_fallback,
    customer_phone: updated.rows[0].customer_phone || order.customer_phone_fallback,
  };

  if (notify) {
    setImmediate(() => {
      sendOrderStatusNotification(updatedOrder).catch((error) => {
        console.error("WhatsApp notification failed:", error.message);
      });
    });
  }

  return updatedOrder;
}
