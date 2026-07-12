// Orders Controller
import { pool } from "../config/database.js";
import { successResponse, errorResponse, asyncHandler } from "../utils/index.js";

// Generate unique order number
const generateOrderNumber = async () => {
  const result = await pool.query("SELECT COUNT(*) as count FROM orders");
  const count = parseInt(result.rows[0].count) + 1;
  return `ORD-${Date.now()}-${count}`;
};

// Get all orders
export const getAllOrders = asyncHandler(async (req, res) => {
  const { status, payment_status, customer_id, date } = req.query;
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  let query = `
    SELECT o.id, o.order_number, o.status, o.payment_status, o.payment_method,
           o.subtotal, o.tax, o.delivery_charge, o.discount, o.total_amount,
           o.created_at, o.estimated_delivery_time, c.name as customer_name,
           c.phone as customer_phone, o.delivery_address, COUNT(oi.id) as item_count,
           json_agg(json_build_object('name', m.name, 'quantity', oi.quantity)) FILTER (WHERE oi.id IS NOT NULL) as items
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN menu m ON oi.menu_id = m.id
    WHERE 1=1
  `;
  const params = [];

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

  query += ` GROUP BY o.id, c.id ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  return successResponse(res, result.rows, "Orders retrieved successfully");
});

// Public recent orders endpoint for customer/order confirmation screens
export const getRecentPublicOrders = asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT
       o.id,
       o.order_number,
       o.status,
       o.total_amount,
       o.created_at,
       c.name AS customer_name,
       c.phone AS customer_phone,
       COUNT(oi.id) AS item_count
     FROM orders o
     JOIN customers c
       ON c.id = o.customer_id
     LEFT JOIN order_items oi
       ON oi.order_id = o.id
     GROUP BY o.id, c.id
     ORDER BY o.created_at DESC
     LIMIT 10`
  );

  return successResponse(res, result.rows, "Recent orders retrieved successfully");
});

// Get order by ID with items
export const getOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const orderResult = await pool.query(
    `SELECT o.id, o.order_number, o.status, o.payment_status, o.payment_method,
            o.subtotal, o.tax, o.delivery_charge, o.discount, o.total_amount,
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
  const { customer_id, items, special_instructions, delivery_address, payment_method } = req.body;

  // Validate required fields
  if (!customer_id || !items || items.length === 0) {
    return errorResponse(res, "Customer ID and items are required", 400);
  }

  // Check customer exists
  const customer = await pool.query(
    "SELECT id, name, phone FROM customers WHERE id = $1",
    [customer_id]
  );
  if (customer.rows.length === 0) {
    return errorResponse(res, "Customer not found", 404);
  }

  try {
    // Start transaction
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

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

      // Generate order number
      const orderNumber = await generateOrderNumber();

      // Insert order
      const orderResult = await client.query(
        `INSERT INTO orders (customer_id, order_number, status, payment_status, payment_method, subtotal, tax, delivery_charge, total_amount, special_instructions, delivery_address)
         VALUES ($1, $2, 'Pending', 'Pending', $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [customer_id, orderNumber, payment_method || "Cash", subtotal, tax, deliveryCharge, totalAmount, special_instructions, delivery_address]
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

      await client.query("COMMIT");

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

      return successResponse(res, order, "Order created successfully", 201);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return errorResponse(res, error.message, 400);
  }
});

// Update order status
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, payment_status } = req.body;

  // Check if order exists
  const existing = await pool.query("SELECT id FROM orders WHERE id = $1", [id]);
  if (existing.rows.length === 0) {
    return errorResponse(res, "Order not found", 404);
  }

  // Valid status values (include 'Delivered' as synonym for 'Completed')
  const validStatuses = ["Pending", "Accepted", "Preparing", "Ready", "Delivered", "Completed", "Cancelled"];
  if (status && !validStatuses.includes(status)) {
    return errorResponse(res, `Invalid status. Must be one of: ${validStatuses.join(", ")}`, 400);
  }

  const validPaymentStatuses = ["Pending", "Paid", "Failed", "Refunded"];
  if (payment_status && !validPaymentStatuses.includes(payment_status)) {
    return errorResponse(res, `Invalid payment status. Must be one of: ${validPaymentStatuses.join(", ")}`, 400);
  }

  const result = await pool.query(
    `UPDATE orders 
     SET status = COALESCE($1, status),
       payment_status = COALESCE($2, payment_status),
       actual_delivery_time = CASE WHEN $1 IN ('Completed','Delivered') THEN CURRENT_TIMESTAMP ELSE actual_delivery_time END,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = $3
     RETURNING *`,
    [status, payment_status, id]
  );

  return successResponse(res, result.rows[0], "Order updated successfully");
});

// Cancel or delete an order
export const deleteOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const existing = await pool.query("SELECT id, status FROM orders WHERE id = $1", [id]);
  if (existing.rows.length === 0) {
    return errorResponse(res, "Order not found", 404);
  }

  if (existing.rows[0].status === "Cancelled") {
    return errorResponse(res, "Order is already cancelled", 409);
  }

  const result = await pool.query(
    `UPDATE orders
     SET status = 'Cancelled',
         payment_status = COALESCE(payment_status, 'Refunded'),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING id, status, payment_status`,
    [id]
  );

  return successResponse(res, result.rows[0], "Order cancelled successfully");
});

export const cancelOrder = deleteOrder;

// Get orders by status (for kitchen)
export const getOrdersByStatus = asyncHandler(async (req, res) => {
  const { status } = req.params;

  const validStatuses = ["Pending", "Accepted", "Preparing", "Ready", "Completed", "Cancelled"];
  if (!validStatuses.includes(status)) {
    return errorResponse(res, `Invalid status. Must be one of: ${validStatuses.join(", ")}`, 400);
  }

  const result = await pool.query(
    `SELECT o.id, o.order_number, o.status, COUNT(oi.id) as item_count,
            array_agg(m.name) as items, o.created_at, c.name as customer_name
     FROM orders o
     LEFT JOIN order_items oi ON o.id = oi.order_id
     LEFT JOIN menu m ON oi.menu_id = m.id
     JOIN customers c ON o.customer_id = c.id
     WHERE o.status = $1
     GROUP BY o.id, c.name
     ORDER BY o.created_at ASC`,
    [status]
  );

  return successResponse(res, result.rows, `${status} orders retrieved successfully`);
});
