import { pool } from '../config/database.js';
import { logger } from '../utils/logger.js';

// Always use a separate pool connection, never the order transaction client.
// PostgreSQL visibility guarantees that only committed orders can be enqueued.
export async function enqueueCommittedOrders(db = pool, orderId = null) {
  return db.query({
    text: `INSERT INTO admin_order_notifications(order_id, payload)
      SELECT o.id, jsonb_build_object(
        'order_id', o.id, 'order_number', o.order_number, 'order_source', o.order_source,
        'order_type', o.order_type, 'table_number', o.table_number, 'token_number', o.token_number)
      FROM orders o
      WHERE o.admin_notification_eligible = TRUE
        AND o.order_source IN ('kiosk', 'website', 'customer_web', 'table_qr')
        AND LOWER(o.status) IN ('confirmed', 'accepted', 'preparing', 'ready',
          'out for delivery', 'out_for_delivery', 'completed')
        AND ($1::bigint IS NULL OR o.id = $1)
        AND NOT EXISTS (SELECT 1 FROM admin_order_notifications n WHERE n.order_id = o.id)
      ORDER BY o.id DESC LIMIT 200
      ON CONFLICT (order_id) DO NOTHING RETURNING order_id`,
    values: [orderId],
    query_timeout: 5000,
  });
}

export function requestAdminOrderCreated(orderId, db = pool) {
  // Fire-and-forget callers cannot fail checkout or sync. The pending reader
  // repairs failures and the crash window between COMMIT and this callback.
  return Promise.resolve().then(() => enqueueCommittedOrders(db, orderId)).catch(error => {
    logger.warn('Admin order notification deferred; pending reader will recover it', {
      code: /^[A-Z0-9_]{1,40}$/.test(error.code || '') ? error.code : 'NOTIFICATION_UNAVAILABLE',
    });
  });
}

export function isValidNotificationCursor(cursor) {
  return typeof cursor === 'string' && /^[1-9]\d{0,18}$/.test(cursor)
    && BigInt(cursor) <= 9223372036854775807n;
}

export async function getPendingOrderNotifications(db = pool, limit = 50, cursor = null) {
  if (cursor !== null && !isValidNotificationCursor(cursor)) throw new TypeError('Invalid notification cursor');
  const pageSize = Math.min(100, Math.max(1, Number.isInteger(limit) ? limit : 50));
  await enqueueCommittedOrders(db);
  // Use the local order ID, not cloud timestamps or recovery/enqueue timestamps.
  // Count item rows separately so quantities/joins cannot multiply saved totals.
  const result = await db.query(`SELECT n.order_id, n.event_type, n.payload, n.created_at,
      o.status, o.total_amount AS grand_total,
      (SELECT COUNT(*)::integer FROM order_items i WHERE i.order_id = o.id) AS item_count
    FROM admin_order_notifications n JOIN orders o ON o.id = n.order_id
    WHERE n.acknowledged_at IS NULL AND LOWER(o.status) = 'confirmed'
      AND ($2::bigint IS NULL OR n.order_id < $2::bigint)
    ORDER BY n.order_id DESC LIMIT $1`, [pageSize + 1, cursor]);
  const notifications = result.rows.slice(0, pageSize);
  const hasMore = result.rows.length > pageSize;
  return { notifications, has_more: hasMore, next_cursor: hasMore ? String(notifications.at(-1).order_id) : null };
}

export async function acknowledgeOrderNotification(orderId, userId, db = pool) {
  const result = await db.query(`UPDATE admin_order_notifications
    SET acknowledged_at = COALESCE(acknowledged_at, CURRENT_TIMESTAMP),
        acknowledged_by = CASE WHEN acknowledged_at IS NULL THEN $2 ELSE acknowledged_by END
    WHERE order_id = $1 RETURNING order_id, acknowledged_at, acknowledged_by`, [orderId, userId]);
  return result.rows[0] || null;
}
