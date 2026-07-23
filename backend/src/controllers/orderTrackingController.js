import { pool } from "../config/database.js";
import { asyncHandler, errorResponse, successResponse } from "../utils/index.js";
import { maskPhoneNumber } from "../utils/phoneNumber.js";
import { ensureOrderSecuritySchema } from "../services/orderSchemaService.js";
import { normalizeOrderStatus } from "../services/orderStatusService.js";

function timelineFor(order) {
  const base = ["confirmed", "accepted", "preparing", "ready"];
  const deliveryTail = String(order.order_type || "").toLowerCase() === "delivery" ? ["out_for_delivery"] : [];
  return [...base, ...deliveryTail, "completed"];
}

function trackingPayload(order, items) {
  const current = normalizeOrderStatus(order.status);
  const timeline = timelineFor(order);

  return {
    orderNumber: order.order_number,
    customerFirstName: String(order.customer_name || "Customer").trim().split(/\s+/)[0],
    maskedPhone: maskPhoneNumber(order.customer_phone),
    orderType: order.order_type || "pickup",
    items,
    orderedAt: order.created_at,
    currentStatus: current,
    statusLabel: order.status,
    timeline,
    estimatedReadyAt: order.estimated_ready_at,
    paymentStatus: order.payment_status,
    cancellationReason: current === "cancelled" ? order.cancellation_reason : null,
    lastUpdatedAt: order.updated_at,
  };
}

export const getTrackedOrder = asyncHandler(async (req, res) => {
  await ensureOrderSecuritySchema();

  const token = String(req.params.trackingToken || "").trim();
  if (!/^[A-Za-z0-9_-]{32,120}$/.test(token)) {
    return errorResponse(res, "Invalid tracking link", 400);
  }

  const orderResult = await pool.query(
    `SELECT o.*, COALESCE(o.customer_name, c.name) AS customer_name,
            COALESCE(o.customer_phone, c.phone) AS customer_phone
     FROM orders o
     JOIN customers c ON c.id = o.customer_id
     WHERE o.tracking_token = $1
     LIMIT 1`,
    [token]
  );

  if (orderResult.rowCount === 0) {
    return errorResponse(res, "Order tracking link not found", 404);
  }

  const order = orderResult.rows[0];
  const items = await pool.query(
    `SELECT m.name, oi.quantity, oi.unit_price, oi.total_price
     FROM order_items oi
     JOIN menu m ON m.id = oi.menu_id
     WHERE oi.order_id = $1
     ORDER BY oi.id`,
    [order.id]
  );

  return successResponse(res, trackingPayload(order, items.rows), "Order tracking loaded");
});

export const streamTrackedOrder = asyncHandler(async (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders?.();

  let closed = false;
  req.on("close", () => {
    closed = true;
  });

  const sendSnapshot = async () => {
    if (closed) return;
    const fakeRes = {
      status: () => fakeRes,
      json: (payload) => {
        res.write(`event: order\n`);
        res.write(`data: ${JSON.stringify(payload.data || payload)}\n\n`);
      },
    };
    await getTrackedOrder({ ...req }, fakeRes, () => {});
  };

  await sendSnapshot();
  const interval = setInterval(sendSnapshot, 15000);
  req.on("close", () => clearInterval(interval));
});
