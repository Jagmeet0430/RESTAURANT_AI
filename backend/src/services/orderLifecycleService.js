import { pool } from "../config/database.js";
import { updateOrderStatusWithHistory } from "./orderStatusService.js";

export const ORDER_EXPIRY_MINUTES = Number(process.env.ORDER_EXPIRY_MINUTES || 20);
export const ORDER_VISIBILITY_MINUTES = Number(process.env.ORDER_VISIBILITY_MINUTES || 20);

let notificationTableReady = false;

export const ensureNotificationTable = async (client = pool) => {
  if (notificationTableReady) return;

  notificationTableReady = true;
};

export const createCustomerNotification = async ({
  client = pool,
  customerId,
  orderId,
  type,
  title,
  message,
}) => {
  if (!customerId || !type || !title || !message) return null;

  try {
    await ensureNotificationTable(client);

    const result = await client.query(
      `INSERT INTO customer_notifications (customer_id, order_id, type, title, message)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, customer_id, order_id, type, title, message, is_read, created_at`,
      [customerId, orderId || null, type, title, message]
    );

    return result.rows[0];
  } catch (error) {
    console.error("Customer notification failed:", error.message);
    return null;
  }
};

export const cancelExpiredPendingOrders = async () => {
  await ensureNotificationTable();

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT id, order_number, customer_id, total_amount, payment_status
       FROM orders
       WHERE status = 'Pending'
         AND created_at <= CURRENT_TIMESTAMP - ($1::int * INTERVAL '1 minute')
       FOR UPDATE`,
      [ORDER_EXPIRY_MINUTES]
    );

    for (const order of result.rows) {
      await updateOrderStatusWithHistory({
        orderId: order.id,
        status: "Cancelled",
        cancellationReason: `Automatically cancelled after ${ORDER_EXPIRY_MINUTES} minutes without acceptance.`,
        client,
        notify: false,
      });

      if (order.payment_status === "Paid") {
        await client.query(
          "UPDATE orders SET payment_status = 'Refunded', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
          [order.id]
        );
      }

      await createCustomerNotification({
        client,
        customerId: order.customer_id,
        orderId: order.id,
        type: "order_cancelled",
        title: "Order cancelled",
        message: `Order ${order.order_number} was automatically cancelled because it was not accepted within ${ORDER_EXPIRY_MINUTES} minutes.`,
      });
    }

    await client.query("COMMIT");

    if (result.rows.length > 0) {
      console.log(`Auto-cancelled ${result.rows.length} pending order(s).`);
    }

    return result.rows;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const terminalVisibilitySql = (alias = "o") =>
  `NOT (
    ${alias}.status IN ('Completed', 'Cancelled')
    AND COALESCE(${alias}.actual_delivery_time, ${alias}.updated_at, ${alias}.created_at)
      <= CURRENT_TIMESTAMP - ($__VISIBILITY_PARAM__::int * INTERVAL '1 minute')
  )`;

export const startOrderLifecycleWorker = () => {
  const intervalMs = Math.max(60_000, Number(process.env.ORDER_LIFECYCLE_INTERVAL_MS || 60_000));

  const run = async () => {
    try {
      await cancelExpiredPendingOrders();
    } catch (error) {
      console.error("Order lifecycle worker failed:", error.message);
    }
  };

  run();
  return setInterval(run, intervalMs);
};
