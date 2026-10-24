import { getPendingOrderNotifications, acknowledgeOrderNotification, isValidNotificationCursor } from '../services/adminOrderNotificationService.js';
import { successResponse, errorResponse } from '../utils/index.js';

export async function getAdminOrderNotifications(req, res) {
  res.set('Cache-Control', 'no-store');
  const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return errorResponse(res, 'Limit must be between 1 and 100.', 400);
  const cursor = req.query.cursor === undefined ? null : req.query.cursor;
  if (cursor !== null && !isValidNotificationCursor(cursor)) return errorResponse(res, 'Invalid notification cursor.', 400);
  try {
    return successResponse(res, await getPendingOrderNotifications(undefined, limit, cursor));
  } catch {
    return errorResponse(res, 'Order notifications are temporarily unavailable. Please retry.', 503);
  }
}

export async function acknowledgeAdminOrderNotification(req, res) {
  res.set('Cache-Control', 'no-store');
  const id = Number(req.params.orderId);
  if (!Number.isSafeInteger(id) || id < 1) return errorResponse(res, 'Invalid order ID.', 400);
  try {
    const notification = await acknowledgeOrderNotification(id, req.user.id);
    if (!notification) return errorResponse(res, 'Order notification not found.', 404);
    return successResponse(res, notification, 'Order notification acknowledged.');
  } catch {
    return errorResponse(res, 'Order notification acknowledgement unavailable. Please retry.', 503);
  }
}
