import crypto from "node:crypto";

import { getRazorpayClient } from "../config/razorpay.js";
import { pool } from "../config/database.js";
import { authMiddleware, authorizeRoles } from "../middleware/index.js";
import { createBillForOrder, normalizeStaffPaymentMethod, payOrder } from "../services/billingService.js";
import { deductInventoryForOrder } from "../services/inventoryStockService.js";
import { createCustomerNotification, ensureNotificationTable } from "../services/orderLifecycleService.js";
import { requireVerifiedPhoneToken } from "../services/otpService.js";
import { ensureOrderSecuritySchema } from "../services/orderSchemaService.js";
import { sendOrderStatusNotification } from "../services/notificationService.js";
import {
  appendOrderContextInstructions,
  ensureTableQrSchema,
  generateDailyTokenNumber,
  normalizeOrderSource,
  resolveTableForOrder,
} from "../services/tableQrService.js";
import { generateTrackingToken } from "../utils/trackingToken.js";
import { normalizePhoneNumber } from "../utils/phoneNumber.js";

const MAX_CART_ITEMS = 50;
const MAX_ITEM_QUANTITY = 20;
const LARGE_ORDER_LOGIN_AMOUNT = 1000;
const GST_RATE = 0.05;
const PACKING_CHARGE = 10;
const MINIMUM_ORDER_VALUE = Number(process.env.MINIMUM_ORDER_VALUE || 0);
const ONLINE_METHODS = new Set(["upi", "card", "netbanking", "wallet"]);
const OFFLINE_METHODS = new Set(["cash_on_delivery", "pay_at_counter"]);

export const getPaymentMethods = (req, res) => {
  const onlineEnabled = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

  return res.json({
    success: true,
    message: "Payment methods retrieved",
    data: {
      online_enabled: onlineEnabled,
      methods: [
        { id: "upi", label: "UPI", gateway: "razorpay", enabled: onlineEnabled },
        { id: "card", label: "Debit/Credit Card", gateway: "razorpay", enabled: onlineEnabled },
        { id: "netbanking", label: "Net Banking", gateway: "razorpay", enabled: onlineEnabled },
        { id: "wallet", label: "Wallet", gateway: "razorpay", enabled: onlineEnabled },
        { id: "cash_on_delivery", label: "Cash on Delivery", gateway: "offline", enabled: true },
        { id: "pay_at_counter", label: "Pay at Restaurant Counter", gateway: "offline", enabled: true },
      ],
    },
  });
};

function timingSafeCompare(received, expected) {
  const receivedBuffer = Buffer.from(String(received || ""), "utf8");
  const expectedBuffer = Buffer.from(String(expected || ""), "utf8");

  return receivedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

function sign(message, secret) {
  return crypto.createHmac("sha256", secret).update(message).digest("hex");
}

function normalizeOnlineMethod(value) {
  const method = String(value || "upi").trim().toLowerCase();
  if (!ONLINE_METHODS.has(method)) {
    const error = new Error("Invalid online payment method");
    error.statusCode = 400;
    throw error;
  }
  return method;
}

function normalizeOfflineMethod(value) {
  const method = String(value || "cash_on_delivery").trim().toLowerCase();
  if (!OFFLINE_METHODS.has(method)) {
    const error = new Error("Invalid offline payment method");
    error.statusCode = 400;
    throw error;
  }
  return method;
}

function orderPaymentLabel(method) {
  const labels = {
    upi: "Razorpay UPI",
    card: "Razorpay Card",
    netbanking: "Razorpay Net Banking",
    wallet: "Razorpay Wallet",
    cash_on_delivery: "Cash on Delivery",
    pay_at_counter: "Pay at Counter",
  };

  return labels[method] || "Razorpay";
}

function publicTotals(totals) {
  return {
    subtotal: totals.subtotal,
    tax: totals.tax,
    delivery_charge: totals.deliveryCharge,
    discount: totals.discount,
    total: totals.total,
  };
}

async function generateOrderNumber(client) {
  const result = await client.query("SELECT COUNT(*) AS count FROM orders");
  const count = Number(result.rows[0]?.count || 0) + 1;
  return `ORD-${Date.now()}-${count}`;
}

function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  return String(Array.isArray(forwarded) ? forwarded[0] : forwarded || req.ip || req.socket?.remoteAddress || "")
    .split(",")[0]
    .trim()
    .slice(0, 80);
}

function normalizeOrderType(value) {
  const normalized = String(value || "pickup").trim().toLowerCase().replace(/\s+/g, "_");
  if (["pickup", "delivery", "dine_in"].includes(normalized)) return normalized;
  return "pickup";
}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    const error = new Error("Order must contain at least one item");
    error.statusCode = 400;
    throw error;
  }

  if (items.length > MAX_CART_ITEMS) {
    const error = new Error(`Cart can contain at most ${MAX_CART_ITEMS} line items`);
    error.statusCode = 400;
    throw error;
  }

  const mergedItems = new Map();

  for (const item of items) {
    const menuId = Number(item.menu_id || item.menu_item_id);
    const quantity = Number(item.quantity);

    if (!Number.isInteger(menuId) || menuId < 1) {
      const error = new Error("Invalid menu item");
      error.statusCode = 400;
      throw error;
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_ITEM_QUANTITY) {
      const error = new Error(`Quantity must be between 1 and ${MAX_ITEM_QUANTITY}`);
      error.statusCode = 400;
      throw error;
    }

    mergedItems.set(menuId, (mergedItems.get(menuId) || 0) + quantity);
  }

  return Array.from(mergedItems, ([menuId, quantity]) => ({ menuId, quantity }));
}

async function calculateOrderAmount(client, items) {
  const normalizedItems = normalizeItems(items);
  const menuIds = normalizedItems.map((item) => item.menuId);

  const menuResult = await client.query(
    `SELECT id, name, price, is_available
     FROM menu
     WHERE id = ANY($1::int[])`,
    [menuIds]
  );

  const menuById = new Map(menuResult.rows.map((item) => [Number(item.id), item]));
  let subtotal = 0;
  const verifiedItems = [];

  for (const item of normalizedItems) {
    const menuItem = menuById.get(item.menuId);

    if (!menuItem) {
      const error = new Error(`Menu item ${item.menuId} not found`);
      error.statusCode = 400;
      throw error;
    }

    if (menuItem.is_available === false) {
      const error = new Error(`${menuItem.name} is currently unavailable`);
      error.statusCode = 409;
      throw error;
    }

    const unitPrice = Number(menuItem.price);
    const itemTotal = Number((unitPrice * item.quantity).toFixed(2));
    subtotal += itemTotal;

    verifiedItems.push({
      menu_id: Number(menuItem.id),
      name: menuItem.name,
      quantity: item.quantity,
      unit_price: unitPrice,
      total_price: itemTotal,
    });
  }

  subtotal = Number(subtotal.toFixed(2));
  const tax = Number((subtotal * GST_RATE).toFixed(2));
  const deliveryCharge = subtotal > 0 ? PACKING_CHARGE : 0;
  const discount = 0;
  const total = Number((subtotal + tax + deliveryCharge - discount).toFixed(2));

  if (subtotal < MINIMUM_ORDER_VALUE) {
    const error = new Error(`Minimum order value is Rs. ${MINIMUM_ORDER_VALUE}`);
    error.statusCode = 400;
    throw error;
  }

  return {
    subtotal,
    tax,
    deliveryCharge,
    discount,
    total,
    verifiedItems,
  };
}

async function requireCustomer(client, customerId) {
  const id = Number(customerId);

  if (!Number.isInteger(id) || id < 1) {
    const error = new Error("Customer ID is required");
    error.statusCode = 400;
    throw error;
  }

  const result = await client.query("SELECT id, name, phone, email FROM customers WHERE id = $1", [id]);

  if (result.rowCount === 0) {
    const error = new Error("Customer not found");
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
}

async function insertOrderWithItems(client, {
  req,
  customerId,
  items,
  paymentMethod,
  paymentStatus,
  specialInstructions,
  otpToken,
  billType = "order",
  orderType = "pickup",
  idempotencyKey = null,
  tableToken = null,
  orderSource = null,
}) {
  await ensureNotificationTable(client);
  await ensureOrderSecuritySchema(client);
  await ensureTableQrSchema(client);

  const cleanIdempotencyKey = String(idempotencyKey || req?.get?.("Idempotency-Key") || "").trim().slice(0, 120) || null;

  if (cleanIdempotencyKey) {
    const existingOrder = await client.query(
      `SELECT *
       FROM orders
       WHERE idempotency_key = $1
       LIMIT 1`,
      [cleanIdempotencyKey]
    );

    if (existingOrder.rowCount > 0) {
      return {
        duplicate: true,
        customer: await requireCustomer(client, existingOrder.rows[0].customer_id),
        order: existingOrder.rows[0],
        totals: {
          subtotal: Number(existingOrder.rows[0].subtotal || 0),
          tax: Number(existingOrder.rows[0].tax || 0),
          deliveryCharge: Number(existingOrder.rows[0].delivery_charge || 0),
          discount: Number(existingOrder.rows[0].discount || 0),
          total: Number(existingOrder.rows[0].total_amount || 0),
        },
        inventoryMovements: [],
        bill: null,
      };
    }
  }

  const customer = await requireCustomer(client, customerId);
  const table = await resolveTableForOrder(client, tableToken);
  const normalizedOrderSource = normalizeOrderSource(orderSource, table ? "table_qr" : "customer_web");
  const contextualInstructions = appendOrderContextInstructions(specialInstructions, {
    orderSource: normalizedOrderSource,
    table,
  });
  const normalizedPhone = normalizePhoneNumber(customer.phone);
  const totals = await calculateOrderAmount(client, items);
  let phoneVerified = false;
  if (otpToken) {
    await requireVerifiedPhoneToken(normalizedPhone, otpToken, {
      client,
      largeOrder: totals.total >= LARGE_ORDER_LOGIN_AMOUNT,
    });
    phoneVerified = true;
  }
  const orderNumber = await generateOrderNumber(client);
  const dailyToken = await generateDailyTokenNumber(client);
  const trackingToken = generateTrackingToken();

  const orderResult = await client.query(
    `INSERT INTO orders (
       customer_id, order_number, status, payment_status, payment_method,
       subtotal, tax, delivery_charge, discount, total_amount, special_instructions,
       customer_name, customer_phone, phone_verified, order_type, tracking_token,
       ip_address, user_agent, idempotency_key, table_id, table_number, order_source,
       token_number, token_date
     )
     VALUES ($1, $2, 'Confirmed', $3, $4, $5, $6, $7, $8, $9, $10,
             $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
     RETURNING *`,
    [
      customer.id,
      orderNumber,
      paymentStatus,
      paymentMethod,
      totals.subtotal,
      totals.tax,
      totals.deliveryCharge,
      totals.discount,
      totals.total,
      contextualInstructions,
      customer.name,
      normalizedPhone,
      phoneVerified,
      table ? "dine_in" : normalizeOrderType(orderType),
      trackingToken,
      clientIp(req),
      String(req?.headers?.["user-agent"] || "").slice(0, 500),
      cleanIdempotencyKey,
      table?.id || null,
      table?.table_number || null,
      normalizedOrderSource,
      dailyToken.token_number,
      dailyToken.token_date,
    ]
  );

  const order = orderResult.rows[0];

  for (const item of totals.verifiedItems) {
    await client.query(
      `INSERT INTO order_items (order_id, menu_id, quantity, unit_price, total_price)
       VALUES ($1, $2, $3, $4, $5)`,
      [order.id, item.menu_id, item.quantity, item.unit_price, item.total_price]
    );
  }

  const inventoryMovements = await deductInventoryForOrder(client, order.id);
  const bill = await createBillForOrder(client, {
    orderId: order.id,
    billType,
  });

  await client.query(
    `INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by)
     VALUES ($1, NULL, 'Confirmed', $2)`,
    [order.id, req?.user?.id || null]
  );

  return { customer, order, totals, inventoryMovements, bill };
}

export const createPaymentOrder = async (req, res) => {
  const client = await pool.connect();

  try {
    const onlineMethod = normalizeOnlineMethod(req.body.payment_method);
    const razorpay = getRazorpayClient();

    await client.query("BEGIN");

    const { duplicate, customer, order, totals, inventoryMovements, bill } = await insertOrderWithItems(client, {
      req,
      customerId: req.body.customer_id,
      items: req.body.items,
      paymentMethod: orderPaymentLabel(onlineMethod),
      paymentStatus: "Pending",
      specialInstructions: req.body.special_instructions,
      otpToken: req.body.otp_verification_token,
      orderType: req.body.order_type,
      idempotencyKey: req.get("Idempotency-Key") || req.body.idempotency_key,
      tableToken: req.body.table_token,
      orderSource: req.body.order_source,
      billType: "online",
    });

    if (duplicate) {
      await client.query("COMMIT");
      return res.status(200).json({
        success: true,
        message: "Duplicate order request ignored",
        data: {
          restaurant_order_id: order.id,
          order_number: order.order_number,
          token_number: order.token_number,
          table_number: order.table_number,
          order_source: order.order_source,
          tracking_token: order.tracking_token,
          tracking_url: `${process.env.FRONTEND_URL || "http://localhost:5001/customer"}/track-order/${order.tracking_token}`,
          totals: publicTotals(totals),
        },
      });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(totals.total * 100),
      currency: "INR",
      receipt: `order_${order.id}_${Date.now()}`.slice(0, 40),
      notes: {
        restaurant_order_id: String(order.id),
        customer_id: String(customer.id),
      },
    });

    await client.query(
      `INSERT INTO payments (
         order_id, customer_id, gateway, payment_method, gateway_order_id,
         amount, currency, payment_status, source_type, source_id
       )
       VALUES ($1, $2, 'razorpay', $3, $4, $5, 'INR', 'pending', 'order', $1)`,
      [order.id, customer.id, onlineMethod, razorpayOrder.id, totals.total]
    );

    await client.query("COMMIT");
    sendOrderStatusNotification({ ...order, customer_name: customer.name, customer_phone: order.customer_phone }).catch((error) =>
      console.error("WhatsApp order confirmation failed:", error.message)
    );

    return res.status(201).json({
      success: true,
      message: "Payment order created",
      data: {
        restaurant_order_id: order.id,
        order_number: order.order_number,
        token_number: order.token_number,
        table_number: order.table_number,
        order_source: order.order_source,
        tracking_token: order.tracking_token,
        tracking_url: `${process.env.FRONTEND_URL || "http://localhost:5001/customer"}/track-order/${order.tracking_token}`,
        razorpay_order_id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        key_id: process.env.RAZORPAY_KEY_ID,
        customer,
        totals: publicTotals(totals),
        bill,
        inventory_movements: inventoryMovements,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create payment order error:", error.message);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to create payment order",
    });
  } finally {
    client.release();
  }
};

export const verifyPayment = async (req, res) => {
  const client = await pool.connect();

  try {
    const restaurantOrderId = Number(req.body.restaurant_order_id);
    const razorpayOrderId = String(req.body.razorpay_order_id || "");
    const razorpayPaymentId = String(req.body.razorpay_payment_id || "");
    const razorpaySignature = String(req.body.razorpay_signature || "");

    if (!Number.isInteger(restaurantOrderId) || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        message: "Missing payment verification fields",
      });
    }

    const paymentLookup = await pool.query(
      `SELECT order_id, gateway_order_id, payment_status
       FROM payments
       WHERE order_id = $1 AND gateway_order_id = $2 AND gateway = 'razorpay'
       LIMIT 1`,
      [restaurantOrderId, razorpayOrderId]
    );

    if (paymentLookup.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found",
      });
    }

    const expectedSignature = sign(`${paymentLookup.rows[0].gateway_order_id}|${razorpayPaymentId}`, process.env.RAZORPAY_KEY_SECRET);

    if (!timingSafeCompare(razorpaySignature, expectedSignature)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    await client.query("BEGIN");

    const orderResult = await client.query("SELECT id, status FROM orders WHERE id = $1 FOR UPDATE", [restaurantOrderId]);

    if (orderResult.rowCount === 0) {
      throw Object.assign(new Error("Order not found"), { statusCode: 404 });
    }

    if (orderResult.rows[0].status === "Cancelled") {
      throw Object.assign(new Error("Order was cancelled before payment confirmation"), { statusCode: 409 });
    }

    const paymentResult = await client.query(
      `UPDATE payments
       SET gateway_payment_id = COALESCE(gateway_payment_id, $1),
           gateway_signature = COALESCE(gateway_signature, $2),
           transaction_id = COALESCE(transaction_id, $1),
           payment_status = 'paid',
           failure_reason = NULL,
           paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP),
           updated_at = CURRENT_TIMESTAMP
       WHERE gateway_order_id = $3
         AND order_id = $4
         AND gateway = 'razorpay'
       RETURNING id, payment_status`,
      [razorpayPaymentId, razorpaySignature, razorpayOrderId, restaurantOrderId]
    );

    if (paymentResult.rowCount === 0) {
      throw Object.assign(new Error("Payment record not found"), { statusCode: 404 });
    }

    const updatedOrder = await client.query(
      `UPDATE orders
       SET payment_status = 'Paid',
           transaction_id = COALESCE(transaction_id, $1),
           paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, order_number, customer_id, status, payment_status, transaction_id`,
      [razorpayPaymentId, restaurantOrderId]
    );

    await createCustomerNotification({
      client,
      customerId: updatedOrder.rows[0].customer_id,
      orderId: restaurantOrderId,
      type: "payment_paid",
      title: "Payment received",
      message: `Payment for order ${updatedOrder.rows[0].order_number} was confirmed.`,
    });

    const bill = await createBillForOrder(client, {
      orderId: restaurantOrderId,
      billType: "online",
    });

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Payment verified and order confirmed",
      data: {
        order_id: restaurantOrderId,
        payment_id: razorpayPaymentId,
        payment_status: "Paid",
        order_status: updatedOrder.rows[0].status,
        bill,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Payment verification error:", error.message);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Payment verification failed",
    });
  } finally {
    client.release();
  }
};

export const createCashOrder = async (req, res) => {
  const client = await pool.connect();

  try {
    const offlineMethod = normalizeOfflineMethod(req.body.payment_method);

    await client.query("BEGIN");

    const { duplicate, customer, order, totals, inventoryMovements, bill } = await insertOrderWithItems(client, {
      req,
      customerId: req.body.customer_id,
      items: req.body.items,
      paymentMethod: orderPaymentLabel(offlineMethod),
      paymentStatus: "Pending",
      specialInstructions: req.body.special_instructions,
      otpToken: req.body.otp_verification_token,
      orderType: req.body.order_type,
      idempotencyKey: req.get("Idempotency-Key") || req.body.idempotency_key,
      tableToken: req.body.table_token,
      orderSource: req.body.order_source,
      billType: "offline",
    });

    if (duplicate) {
      await client.query("COMMIT");
      return res.status(200).json({
        success: true,
        message: "Duplicate order request ignored",
        data: {
          order,
          totals: publicTotals(totals),
          tracking_url: `${process.env.FRONTEND_URL || "http://localhost:5001/customer"}/track-order/${order.tracking_token}`,
        },
      });
    }

    await client.query(
      `INSERT INTO payments (
         order_id, customer_id, gateway, payment_method, amount, currency, payment_status,
         source_type, source_id
       )
       VALUES ($1, $2, 'offline', $3, $4, 'INR', 'pending', 'order', $1)`,
      [order.id, customer.id, offlineMethod, totals.total]
    );

    const notification = await createCustomerNotification({
      client,
      customerId: customer.id,
      orderId: order.id,
      type: "order_placed",
      title: "Order placed",
      message: `Order ${order.order_number} was placed. Please pay ${orderPaymentLabel(offlineMethod).toLowerCase()}.`,
    });

    await client.query("COMMIT");
    sendOrderStatusNotification({ ...order, customer_name: customer.name, customer_phone: order.customer_phone }).catch((error) =>
      console.error("WhatsApp order confirmation failed:", error.message)
    );

    return res.status(201).json({
      success: true,
      message: "Offline payment order placed successfully",
      data: {
        order,
        tracking_url: `${process.env.FRONTEND_URL || "http://localhost:5001/customer"}/track-order/${order.tracking_token}`,
        notification,
        totals: publicTotals(totals),
        bill,
        inventory_movements: inventoryMovements,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Offline order error:", error.message);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to place order",
    });
  } finally {
    client.release();
  }
};

export const markOrderPaid = [
  authMiddleware,
  authorizeRoles(["admin", "staff", "manager"]),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const orderId = Number(req.params.orderId);

      if (!Number.isInteger(orderId) || orderId < 1) {
        return res.status(400).json({ success: false, message: "Invalid order ID" });
      }

      await client.query("BEGIN");
      const method = normalizeStaffPaymentMethod(req.body.payment_method || req.body.paymentMethod || "cash");
      const result = await payOrder(client, {
        orderId,
        paymentMethod: method.code,
        expectedTotal: req.body.expected_total ?? req.body.expectedTotal,
        createdBy: req.user?.id || null,
      });

      await client.query("COMMIT");

      return res.json({
        success: true,
        message: result.alreadyPaid ? "Payment was already marked as paid" : "Payment marked as paid",
        data: { ...result.order, bill: result.bill, already_paid: result.alreadyPaid },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Unable to mark payment paid",
      });
    } finally {
      client.release();
    }
  },
];

async function markRazorpayPaid(client, { gatewayOrderId, gatewayPaymentId }) {
  const paymentResult = await client.query(
    `UPDATE payments
     SET gateway_payment_id = COALESCE(gateway_payment_id, $1),
         transaction_id = COALESCE(transaction_id, $1),
         payment_status = 'paid',
         failure_reason = NULL,
         paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP,
         source_type = 'order',
         source_id = order_id
     WHERE gateway_order_id = $2
       AND gateway = 'razorpay'
     RETURNING order_id`,
    [gatewayPaymentId || null, gatewayOrderId]
  );

  for (const payment of paymentResult.rows) {
    const orderResult = await client.query(
      `UPDATE orders
       SET payment_status = 'Paid',
           transaction_id = COALESCE(transaction_id, $1),
           paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
         AND status <> 'Cancelled'
       RETURNING id`,
      [gatewayPaymentId || null, payment.order_id]
    );

    if (orderResult.rowCount > 0) {
      await createBillForOrder(client, {
        orderId: payment.order_id,
        billType: "online",
      });
    }
  }
}

async function markRazorpayFailed(client, { gatewayOrderId, gatewayPaymentId, reason }) {
  const paymentResult = await client.query(
    `UPDATE payments
     SET gateway_payment_id = COALESCE(gateway_payment_id, $1),
         transaction_id = COALESCE(transaction_id, $1),
         payment_status = CASE WHEN payment_status = 'paid' THEN payment_status ELSE 'failed' END,
         failure_reason = CASE WHEN payment_status = 'paid' THEN failure_reason ELSE $2 END,
         updated_at = CURRENT_TIMESTAMP
     WHERE gateway_order_id = $3
       AND gateway = 'razorpay'
     RETURNING order_id, payment_status`,
    [gatewayPaymentId || null, reason || "Payment failed", gatewayOrderId]
  );

  for (const payment of paymentResult.rows) {
    if (payment.payment_status !== "paid") {
      await client.query(
        `UPDATE orders
         SET payment_status = 'Failed',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
           AND payment_status <> 'Paid'`,
        [payment.order_id]
      );
    }
  }
}

export const handleWebhook = async (req, res) => {
  try {
    if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
      return res.status(503).json({ success: false, message: "Webhook secret is not configured" });
    }

    const receivedSignature = req.get("X-Razorpay-Signature");
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
    const expectedSignature = sign(rawBody, process.env.RAZORPAY_WEBHOOK_SECRET);

    if (!receivedSignature || !timingSafeCompare(receivedSignature, expectedSignature)) {
      return res.status(400).json({ success: false, message: "Invalid webhook signature" });
    }

    const eventId = req.get("x-razorpay-event-id");
    const event = JSON.parse(rawBody.toString("utf8"));
    const eventType = String(event.event || "");

    if (!eventId) {
      return res.status(400).json({ success: false, message: "Missing webhook event id" });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const eventInsert = await client.query(
        `INSERT INTO payment_webhook_events (event_id, event_type)
         VALUES ($1, $2)
         ON CONFLICT (event_id) DO NOTHING
         RETURNING event_id`,
        [eventId, eventType]
      );

      if (eventInsert.rowCount === 0) {
        await client.query("COMMIT");
        return res.json({ success: true, message: "Webhook already processed" });
      }

      const paymentEntity = event.payload?.payment?.entity;
      const orderEntity = event.payload?.order?.entity;

      if (eventType === "payment.captured") {
        await markRazorpayPaid(client, {
          gatewayOrderId: paymentEntity?.order_id,
          gatewayPaymentId: paymentEntity?.id,
        });
      } else if (eventType === "order.paid") {
        await markRazorpayPaid(client, {
          gatewayOrderId: orderEntity?.id,
          gatewayPaymentId: paymentEntity?.id,
        });
      } else if (eventType === "payment.failed") {
        await markRazorpayFailed(client, {
          gatewayOrderId: paymentEntity?.order_id,
          gatewayPaymentId: paymentEntity?.id,
          reason: paymentEntity?.error_description || paymentEntity?.error_reason,
        });
      } else if (eventType === "refund.processed") {
        const refundEntity = event.payload?.refund?.entity;
        await client.query(
          `UPDATE payments
           SET payment_status = 'refunded',
               refunded_at = COALESCE(refunded_at, CURRENT_TIMESTAMP),
               updated_at = CURRENT_TIMESTAMP
           WHERE gateway_payment_id = $1
             AND gateway = 'razorpay'`,
          [refundEntity?.payment_id]
        );
        await client.query(
          `UPDATE orders
           SET payment_status = 'Refunded',
               updated_at = CURRENT_TIMESTAMP
           WHERE transaction_id = $1`,
          [refundEntity?.payment_id]
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return res.json({ success: true, message: "Webhook processed" });
  } catch (error) {
    console.error("Razorpay webhook error:", error.message);
    return res.status(500).json({ success: false, message: "Webhook processing failed" });
  }
};
