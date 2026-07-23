import { pool } from "../config/database.js";
import { asyncHandler, errorResponse, successResponse } from "../utils/index.js";
import { updateOrderStatusWithHistory } from "../services/orderStatusService.js";
import { ensureOrderSecuritySchema } from "../services/orderSchemaService.js";
import { retryWhatsAppNotification } from "../services/notificationService.js";

export const patchAdminOrderStatus = asyncHandler(async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const order = await updateOrderStatusWithHistory({
      orderId: Number(req.params.orderId),
      status: req.body.status,
      estimatedMinutes: req.body.estimatedMinutes,
      cancellationReason: req.body.cancellationReason,
      changedBy: req.user?.id || null,
      client,
    });
    await client.query("COMMIT");
    return successResponse(res, order, "Order status updated");
  } catch (error) {
    await client.query("ROLLBACK");
    return errorResponse(res, error.message, error.statusCode || 500);
  } finally {
    client.release();
  }
});

export const getAdminOrderStatusHistory = asyncHandler(async (req, res) => {
  await ensureOrderSecuritySchema();
  const result = await pool.query(
    `SELECT *
     FROM order_status_history
     WHERE order_id = $1
     ORDER BY created_at DESC`,
    [req.params.orderId]
  );
  return successResponse(res, result.rows, "Order status history loaded");
});

export const retryAdminOrderNotification = asyncHandler(async (req, res) => {
  try {
    const notification = await retryWhatsAppNotification(Number(req.params.orderId));
    return successResponse(res, notification, "WhatsApp notification retry queued");
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
});
