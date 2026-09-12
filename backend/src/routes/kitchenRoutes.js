// Kitchen Routes

import express from "express";
import { authMiddleware, authorizeRoles } from "../middleware/index.js";
import { updateOrderStatus, getOrdersByStatus } from "../controllers/ordersController.js";
import { cancelExpiredPendingOrders } from "../services/orderLifecycleService.js";
import { ensureTableQrSchema } from "../services/tableQrService.js";

const router = express.Router();
const kitchenRoles = authorizeRoles(["admin", "staff", "kitchen_staff"]);

// Get live kitchen orders using the same workflow statuses as the Orders board.
router.get("/orders", authMiddleware, kitchenRoles, async (req, res) => {
  try {
    await ensureTableQrSchema();
    await cancelExpiredPendingOrders();

    const statuses = ["Confirmed", "Accepted", "Preparing", "Ready", "Out for Delivery"];
    const result = await req.app.locals.pool.query(
      `SELECT o.id,
              o.order_number,
              o.token_number,
              o.status,
              o.payment_status,
              o.payment_method,
              o.table_id,
              o.table_number,
              o.order_source,
              o.subtotal,
              o.tax,
              o.delivery_charge,
              o.discount,
              o.total_amount,
              o.created_at,
              o.updated_at,
              o.delivery_address,
              o.special_instructions,
              c.name AS customer_name,
              c.phone AS customer_phone,
              COUNT(oi.id) AS item_count,
              COALESCE(
                json_agg(
                  json_build_object(
                    'name', m.name,
                    'quantity', oi.quantity,
                    'unit_price', oi.unit_price,
                    'total_price', oi.total_price,
                    'special_instructions', oi.special_instructions
                  )
                  ORDER BY oi.id
                ) FILTER (WHERE oi.id IS NOT NULL),
                '[]'::json
              ) AS items
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN menu m ON oi.menu_id = m.id
       WHERE o.status = ANY($1)
         AND NOT (
           COALESCE(o.payment_status, 'Pending') <> 'Paid'
           AND (
               LOWER(COALESCE(o.payment_method, '')) LIKE 'razorpay%'
               OR (
                 LOWER(COALESCE(o.payment_method, '')) = 'pay at counter'
                 AND COALESCE(o.order_source, '') <> 'table_qr'
                 AND COALESCE(o.special_instructions, '') NOT LIKE '%Source: Kiosk%'
               )
             )
         )
       GROUP BY o.id, c.id
       ORDER BY o.created_at ASC`,
      [statuses]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get orders by specific status
router.get("/orders/status/:status", authMiddleware, kitchenRoles, getOrdersByStatus);

// Update order status (move to next stage)
router.put("/orders/:id/status", authMiddleware, kitchenRoles, updateOrderStatus);

export default router;
