// Orders Controller
import { pool } from "../config/database.js";
import { successResponse, errorResponse, asyncHandler } from "../utils/index.js";
import {
  ORDER_VISIBILITY_MINUTES,
  cancelExpiredPendingOrders,
  createCustomerNotification,
  ensureNotificationTable,
  terminalVisibilitySql,
} from "../services/orderLifecycleService.js";
import { requireVerifiedPhoneToken } from "../services/otpService.js";
import { createBillForOrder } from "../services/billingService.js";
import { deductInventoryForOrder } from "../services/inventoryStockService.js";
import { ensureOrderSecuritySchema } from "../services/orderSchemaService.js";
import {
  normalizeOrderStatus,
  statusForStorage,
  updateOrderStatusWithHistory,
} from "../services/orderStatusService.js";
import { sendOrderStatusNotification } from "../services/notificationService.js";
import {
  appendOrderContextInstructions,
  ensureTableQrSchema,
  generateDailyTokenNumber,
  normalizeOrderSource,
  resolveTableForOrder,
} from "../services/tableQrService.js";
import { generateTrackingToken } from "../utils/trackingToken.js";
import { normalizePhoneNumber, phoneLookupCandidates } from "../utils/phoneNumber.js";

const MAX_ITEM_QUANTITY = 20;
const MAX_CART_ITEMS = 50;
const LARGE_ORDER_LOGIN_AMOUNT = 1000;
const MINIMUM_ORDER_VALUE = Number(process.env.MINIMUM_ORDER_VALUE || 0);

const requiresPaymentBeforeKitchen = (order) => {
  const method = String(order.payment_method || "").toLowerCase();
  const paymentStatus = String(order.payment_status || "").toLowerCase();

  return paymentStatus !== "paid" && (method.startsWith("razorpay") || method === "pay at counter");
};

function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  return String(Array.isArray(forwarded) ? forwarded[0] : forwarded || req.ip || req.socket?.remoteAddress || "")
    .split(",")[0]
    .trim()
    .slice(0, 80);
}

function normalizeOrderType(value) {
  const normalized = String(value || "pickup").trim().toLowerCase().replace(/\s+/g, "_");
  return ["pickup", "delivery", "dine_in"].includes(normalized) ? normalized : "pickup";
}

// Generate unique order number
const generateOrderNumber = async () => {
  const result = await pool.query("SELECT COUNT(*) as count FROM orders");
  const count = parseInt(result.rows[0].count) + 1;
  return `ORD-${Date.now()}-${count}`;
};

// Get all orders
export const getAllOrders = asyncHandler(async (req, res) => {
  await ensureOrderSecuritySchema();
  await ensureTableQrSchema();
  await cancelExpiredPendingOrders();

  const { status, payment_status, customer_id, date } = req.query;
  const includeExpired = req.query.include_expired === "true";
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  let query = `
    SELECT o.id, o.order_number, o.status, o.payment_status, o.payment_method,
           o.transaction_id, o.paid_at,
           o.subtotal, o.tax, o.delivery_charge, o.discount, o.total_amount,
           o.phone_verified, o.order_type, o.tracking_token, o.cancellation_reason, o.estimated_ready_at,
           o.table_id, o.table_number, o.order_source, o.token_number, o.token_date,
           wn.delivery_status AS whatsapp_status, wn.error_message AS whatsapp_error,
           o.created_at, o.updated_at, o.estimated_delivery_time, o.actual_delivery_time,
           COALESCE(o.customer_name, c.name) as customer_name,
           COALESCE(o.customer_phone, c.phone) as customer_phone,
           o.delivery_address, COUNT(oi.id) as item_count,
           json_agg(json_build_object('name', m.name, 'quantity', oi.quantity)) FILTER (WHERE oi.id IS NOT NULL) as items
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN menu m ON oi.menu_id = m.id
    LEFT JOIN LATERAL (
      SELECT delivery_status, error_message
      FROM whatsapp_notifications
      WHERE order_id = o.id
      ORDER BY created_at DESC
      LIMIT 1
    ) wn ON TRUE
    WHERE 1=1
  `;
  const params = [];

  if (!includeExpired) {
    params.push(ORDER_VISIBILITY_MINUTES);
    query += ` AND ${terminalVisibilitySql("o").replace("$__VISIBILITY_PARAM__", `$${params.length}`)}`;
  }

  if (status) {
    query += ` AND o.status = $${params.length + 1}`;
    params.push(status);
  }

  if (payment_status) {
    query += ` AND o.payment_status = $${params.length + 1}`;
    params.push(payment_status);
  }

  if (customer_id) {
    query += ` AND o.customer_id = $${params.length + 1}`;
    params.push(customer_id);
  }

  if (date) {
    query += ` AND DATE(o.created_at) = $${params.length + 1}`;
    params.push(date);
  }

  query += ` GROUP BY o.id, c.id, wn.delivery_status, wn.error_message ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  return successResponse(res, result.rows, "Orders retrieved successfully");
});

// Public recent orders endpoint for customer/order confirmation screens
export const getRecentPublicOrders = asyncHandler(async (req, res) => {
  await ensureTableQrSchema();
  await cancelExpiredPendingOrders();

  const result = await pool.query(
    `SELECT
       o.id,
       o.order_number,
       o.token_number,
       o.table_number,
       o.order_source,
       o.status,
       o.total_amount,
       o.created_at,
       c.name AS customer_name,
       c.phone AS customer_phone,
       COUNT(oi.id) AS item_count,
       json_agg(
         json_build_object(
           'menu_id', oi.menu_id,
           'name', m.name,
           'quantity', oi.quantity,
           'unit_price', oi.unit_price,
           'total_price', oi.total_price
         )
       ) FILTER (WHERE oi.id IS NOT NULL) AS items
     FROM orders o
     JOIN customers c
       ON c.id = o.customer_id
     LEFT JOIN order_items oi
       ON oi.order_id = o.id
     LEFT JOIN menu m
       ON m.id = oi.menu_id
     GROUP BY o.id, c.id
     ORDER BY o.created_at DESC
     LIMIT 10`
  );

  return successResponse(res, result.rows, "Recent orders retrieved successfully");
});

// Get order by ID with items
export const getOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await ensureTableQrSchema();

  const orderResult = await pool.query(
    `SELECT o.id, o.order_number, o.status, o.payment_status, o.payment_method,
            o.transaction_id, o.paid_at,
            o.subtotal, o.tax, o.delivery_charge, o.discount, o.total_amount,
            o.table_id, o.table_number, o.order_source, o.token_number, o.token_date,
            o.special_instructions, o.delivery_address, o.created_at,
            o.estimated_delivery_time, o.actual_delivery_time,
            c.id as customer_id, c.name as customer_name, c.phone as customer_phone, c.email
     FROM orders o
     JOIN customers c ON o.customer_id = c.id
     WHERE o.id = $1`,
    [id]
  );

  if (orderResult.rows.length === 0) {
    return errorResponse(res, "Order not found", 404);
  }

  const itemsResult = await pool.query(
    `SELECT oi.id, oi.menu_id, m.name, m.veg_type, oi.quantity, oi.unit_price, oi.total_price, oi.special_instructions
     FROM order_items oi
     JOIN menu m ON oi.menu_id = m.id
     WHERE oi.order_id = $1`,
    [id]
  );

  const order = orderResult.rows[0];
  return successResponse(res, { ...order, items: itemsResult.rows }, "Order retrieved successfully");
});

// Create new order
export const createOrder = asyncHandler(async (req, res) => {
  await ensureOrderSecuritySchema();
  const {
    customer_id,
    customerName,
    phone,
    items,
    special_instructions,
    delivery_address,
    payment_method,
    paymentMethod,
    otp_verification_token,
    verificationToken,
    order_type,
    orderType,
    table_token,
    order_source,
  } = req.body;
  let resolvedCustomerId = customer_id;

  // Validate required fields
  if ((!resolvedCustomerId && (!customerName || !phone)) || !items || items.length === 0) {
    return errorResponse(res, "Customer details and items are required", 400);
  }

  if (items.length > MAX_CART_ITEMS) {
    return errorResponse(res, `Cart can contain at most ${MAX_CART_ITEMS} line items`, 400);
  }

  for (const item of items) {
    item.menu_id = Number(item.menu_id || item.menuItemId || item.menu_item_id);
    const quantity = Number(item.quantity);

    if (!Number.isInteger(item.menu_id) || item.menu_id < 1) {
      return errorResponse(res, "Invalid menu item", 400);
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_ITEM_QUANTITY) {
      return errorResponse(res, `Quantity must be between 1 and ${MAX_ITEM_QUANTITY}`, 400);
    }
  }

  if (!resolvedCustomerId) {
    const normalizedPhone = normalizePhoneNumber(phone);
    const existingCustomer = await pool.query(
      "SELECT id FROM customers WHERE phone = ANY($1::text[]) ORDER BY phone = $2 DESC, id DESC LIMIT 1",
      [phoneLookupCandidates(phone), normalizedPhone]
    );
    if (existingCustomer.rowCount > 0) {
      resolvedCustomerId = existingCustomer.rows[0].id;
    } else {
      const insertedCustomer = await pool.query(
        `INSERT INTO customers (name, phone, country, is_active)
         VALUES ($1, $2, 'India', TRUE)
         RETURNING id`,
        [String(customerName).trim(), normalizedPhone]
      );
      resolvedCustomerId = insertedCustomer.rows[0].id;
    }
  }

  // Check customer exists
  const customer = await pool.query(
    "SELECT id, name, phone FROM customers WHERE id = $1",
    [resolvedCustomerId]
  );
  if (customer.rows.length === 0) {
    return errorResponse(res, "Customer not found", 404);
  }

  try {
    await ensureNotificationTable();

    // Start transaction
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await ensureOrderSecuritySchema(client);
      await ensureTableQrSchema(client);

      const idempotencyKey = String(req.get("Idempotency-Key") || req.body.idempotency_key || "").trim().slice(0, 120) || null;
      if (idempotencyKey) {
        const existingOrder = await client.query("SELECT * FROM orders WHERE idempotency_key = $1 LIMIT 1", [idempotencyKey]);
        if (existingOrder.rowCount > 0) {
          await client.query("COMMIT");
          return successResponse(res, existingOrder.rows[0], "Duplicate order request ignored");
        }
      }

      const table = await resolveTableForOrder(client, table_token);
      const normalizedOrderSource = normalizeOrderSource(order_source, table ? "table_qr" : "customer_web");
      const normalizedOrderType = table ? "dine_in" : normalizeOrderType(order_type || orderType);
      const contextualInstructions = appendOrderContextInstructions(special_instructions, {
        orderSource: normalizedOrderSource,
        table,
      });

      // Calculate totals
      let subtotal = 0;
      const menuIds = items.map((item) => item.menu_id);

      // Get menu item prices
      const menuResult = await client.query(
        `SELECT id, price FROM menu WHERE id = ANY($1)`,
        [menuIds]
      );

      const menuPrices = {};
      menuResult.rows.forEach((item) => {
        menuPrices[item.id] = item.price;
      });

      // Validate all items exist and calculate subtotal
      for (const item of items) {
        if (!menuPrices[item.menu_id]) {
          throw new Error(`Menu item ${item.menu_id} not found`);
        }
        subtotal += menuPrices[item.menu_id] * item.quantity;
      }

      const tax = Math.round(subtotal * 0.05 * 100) / 100; // 5% GST
      const deliveryCharge = 10; // Packing charge
      const totalAmount = subtotal + tax + deliveryCharge;
      if (subtotal < MINIMUM_ORDER_VALUE) {
        throw Object.assign(new Error(`Minimum order value is Rs. ${MINIMUM_ORDER_VALUE}`), { statusCode: 400 });
      }

      const normalizedPhone = normalizePhoneNumber(customer.rows[0].phone);
      const verificationTokenToUse = otp_verification_token || verificationToken;
      let phoneVerified = false;
      if (verificationTokenToUse) {
        await requireVerifiedPhoneToken(normalizedPhone, verificationTokenToUse, {
          client,
          largeOrder: totalAmount >= LARGE_ORDER_LOGIN_AMOUNT,
        });
        phoneVerified = true;
      }

      // Generate order number
      const orderNumber = await generateOrderNumber();
      const dailyToken = await generateDailyTokenNumber(client);

      // Insert order
      const trackingToken = generateTrackingToken();
      const orderResult = await client.query(
        `INSERT INTO orders (
           customer_id, order_number, status, payment_status, payment_method,
           subtotal, tax, delivery_charge, total_amount, special_instructions, delivery_address,
           customer_name, customer_phone, phone_verified, order_type, tracking_token,
           ip_address, user_agent, idempotency_key, table_id, table_number, order_source,
           token_number, token_date
         )
         VALUES ($1, $2, 'Confirmed', 'Pending', $3, $4, $5, $6, $7, $8, $9,
                 $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
         RETURNING *`,
        [
          resolvedCustomerId,
          orderNumber,
          payment_method || paymentMethod || "Cash",
          subtotal,
          tax,
          deliveryCharge,
          totalAmount,
          contextualInstructions,
          delivery_address,
          customer.rows[0].name,
          normalizedPhone,
          phoneVerified,
          normalizedOrderType,
          trackingToken,
          clientIp(req),
          String(req.headers["user-agent"] || "").slice(0, 500),
          idempotencyKey,
          table?.id || null,
          table?.table_number || null,
          normalizedOrderSource,
          dailyToken.token_number,
          dailyToken.token_date,
        ]
      );

      const order = orderResult.rows[0];

      // Insert order items
      for (const item of items) {
        const itemTotal = menuPrices[item.menu_id] * item.quantity;
        await client.query(
          `INSERT INTO order_items (order_id, menu_id, quantity, unit_price, total_price, special_instructions)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [order.id, item.menu_id, item.quantity, menuPrices[item.menu_id], itemTotal, item.special_instructions]
        );
      }

      const inventoryMovements = await deductInventoryForOrder(client, order.id, {
        createdBy: req.user?.id || null,
      });
      const bill = await createBillForOrder(client, {
        orderId: order.id,
        billType: "order",
        createdBy: req.user?.id || null,
      });
      await client.query(
        `INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by)
         VALUES ($1, NULL, 'Confirmed', $2)`,
        [order.id, req.user?.id || null]
      );

      await client.query("COMMIT");
      sendOrderStatusNotification(order).catch((error) =>
        console.error("WhatsApp order confirmation failed:", error.message)
      );

      const notification = await createCustomerNotification({
        customerId: order.customer_id,
        orderId: order.id,
        type: "order_placed",
        title: "Order placed",
        message: `Order ${order.order_number} was placed successfully and is waiting for restaurant acceptance.`,
      });

      console.log("========== NEW ORDER RECEIVED ==========");
      console.log("Order:", order.order_number);
      console.log("Customer:", `${customer.rows[0].name} (${customer.rows[0].phone})`);
      console.log("Items:", items.length);
      console.log("Subtotal:", `Rs. ${Number(subtotal).toFixed(0)}`);
      console.log("GST:", `Rs. ${Number(tax).toFixed(0)}`);
      console.log("Packing:", `Rs. ${Number(deliveryCharge).toFixed(0)}`);
      console.log("Grand total:", `Rs. ${Number(totalAmount).toFixed(0)}`);
      console.log("Status:", order.status);
      console.log("========================================");

      return successResponse(
        res,
        { ...order, notification, bill, inventory_movements: inventoryMovements },
        "Order created successfully",
        201
      );
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 400);
  }
});

// Update order status
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, payment_status, estimatedMinutes, cancellationReason } = req.body;

  // Check if order exists
  const existing = await pool.query(
    "SELECT id, status, customer_id, order_number, payment_method, payment_status FROM orders WHERE id = $1",
    [id]
  );
  if (existing.rows.length === 0) {
    return errorResponse(res, "Order not found", 404);
  }

  // Valid status values (include 'Delivered' as synonym for 'Completed')
  const validStatuses = [
    "pending_verification",
    "confirmed",
    "accepted",
    "preparing",
    "ready",
    "out_for_delivery",
    "completed",
    "cancelled",
    "Pending",
    "Confirmed",
    "Accepted",
    "Preparing",
    "Ready",
    "Out for Delivery",
    "Delivered",
    "Completed",
    "Cancelled",
  ];
  if (status && !validStatuses.includes(status)) {
    return errorResponse(res, `Invalid status. Must be one of: ${validStatuses.join(", ")}`, 400);
  }

  if (
    status &&
    !["Pending", "Cancelled"].includes(status) &&
    requiresPaymentBeforeKitchen(existing.rows[0])
  ) {
    return errorResponse(
      res,
      "Collect and mark payment as paid before sending this order to the kitchen.",
      409
    );
  }

  const validPaymentStatuses = ["Pending", "Paid", "Failed", "Refunded"];
  if (payment_status && !validPaymentStatuses.includes(payment_status)) {
    return errorResponse(res, `Invalid payment status. Must be one of: ${validPaymentStatuses.join(", ")}`, 400);
  }

  const client = await pool.connect();
  let result;
  try {
    await client.query("BEGIN");
    let updated = existing.rows[0];
    if (status) {
      updated = await updateOrderStatusWithHistory({
        orderId: Number(id),
        status,
        estimatedMinutes,
        cancellationReason,
        changedBy: req.user?.id || null,
        client,
      });
    }

    if (payment_status) {
      const paymentUpdate = await client.query(
        `UPDATE orders
         SET payment_status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [payment_status, id]
      );
      updated = paymentUpdate.rows[0];
    }

    await client.query("COMMIT");
    result = { rows: [updated] };
  } catch (error) {
    await client.query("ROLLBACK");
    return errorResponse(res, error.message, error.statusCode || 500);
  } finally {
    client.release();
  }

  if (normalizeOrderStatus(status) === "cancelled" && existing.rows[0].status !== "Cancelled") {
    await createCustomerNotification({
      customerId: existing.rows[0].customer_id,
      orderId: existing.rows[0].id,
      type: "order_cancelled",
      title: "Order cancelled",
      message: `Order ${existing.rows[0].order_number} was cancelled by the restaurant.`,
    });
  }

  return successResponse(res, result.rows[0], "Order updated successfully");
});

// Cancel or delete an order
export const deleteOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const cancellationReason =
    String(req.body?.cancellationReason || req.body?.cancellation_reason || "").trim() ||
    "Cancelled by restaurant";

  const existing = await pool.query("SELECT id, status, customer_id, order_number FROM orders WHERE id = $1", [id]);
  if (existing.rows.length === 0) {
    return errorResponse(res, "Order not found", 404);
  }

  if (existing.rows[0].status === "Cancelled") {
    return errorResponse(res, "Order is already cancelled", 409);
  }

  const client = await pool.connect();
  let cancelledOrder;

  try {
    await client.query("BEGIN");
    cancelledOrder = await updateOrderStatusWithHistory({
      orderId: Number(id),
      status: "Cancelled",
      cancellationReason,
      changedBy: req.user?.id || null,
      client,
    });

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    return errorResponse(res, error.message, error.statusCode || 500);
  } finally {
    client.release();
  }

  await createCustomerNotification({
    customerId: existing.rows[0].customer_id,
    orderId: existing.rows[0].id,
    type: "order_cancelled",
    title: "Order cancelled",
    message: `Order ${existing.rows[0].order_number} was cancelled by the restaurant. Reason: ${cancellationReason}`,
  });

  return successResponse(res, cancelledOrder, "Order cancelled successfully");
});

export const cancelOrder = deleteOrder;

// Get orders by status (for kitchen)
export const getOrdersByStatus = asyncHandler(async (req, res) => {
  const { status } = req.params;

  const validStatuses = [
    "Pending",
    "Confirmed",
    "Accepted",
    "Preparing",
    "Ready",
    "Out for Delivery",
    "Completed",
    "Cancelled",
  ];
  if (!validStatuses.includes(status)) {
    return errorResponse(res, `Invalid status. Must be one of: ${validStatuses.join(", ")}`, 400);
  }

  const storageStatus = statusForStorage(status);
  await ensureTableQrSchema();

  const result = await pool.query(
    `SELECT o.id, o.order_number, o.token_number, o.status, o.table_id, o.table_number, o.order_source,
            COUNT(oi.id) as item_count,
            array_agg(m.name) as items, o.created_at, c.name as customer_name
     FROM orders o
     LEFT JOIN order_items oi ON o.id = oi.order_id
     LEFT JOIN menu m ON oi.menu_id = m.id
     JOIN customers c ON o.customer_id = c.id
     WHERE o.status = $1
       AND NOT (
         o.payment_status <> 'Paid'
         AND (
           o.payment_method LIKE 'Razorpay%'
           OR (
             o.payment_method = 'Pay at Counter'
             AND COALESCE(o.order_source, '') <> 'table_qr'
             AND COALESCE(o.special_instructions, '') NOT LIKE '%Source: Kiosk%'
           )
         )
       )
     GROUP BY o.id, c.name
     ORDER BY o.created_at ASC`,
    [storageStatus]
  );

  return successResponse(res, result.rows, `${storageStatus} orders retrieved successfully`);
});
