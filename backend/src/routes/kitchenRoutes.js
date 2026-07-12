// Kitchen Routes

import express from "express";
import { authMiddleware } from "../middleware/index.js";
import { getAllOrders, updateOrderStatus, getOrdersByStatus } from "../controllers/ordersController.js";

const router = express.Router();

// Get kitchen orders (Pending, Preparing, Ready, Completed)
router.get("/orders", authMiddleware, async (req, res) => {
  try {
    const statuses = ["Pending", "Accepted", "Preparing", "Ready", "Completed"];
    const result = await req.app.locals.pool.query(
      `SELECT o.id, o.order_number, o.status, COUNT(oi.id) as item_count,
              json_agg(json_build_object('name', m.name, 'quantity', oi.quantity)) FILTER (WHERE oi.id IS NOT NULL) as items,
              o.created_at, c.name as customer_name, o.special_instructions
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN menu m ON oi.menu_id = m.id
       JOIN customers c ON o.customer_id = c.id
       WHERE o.status = ANY($1)
       GROUP BY o.id, c.name
       ORDER BY o.created_at ASC`,
      [statuses]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get orders by specific status
router.get("/orders/status/:status", authMiddleware, getOrdersByStatus);

// Update order status (move to next stage)
router.put("/orders/:id/status", authMiddleware, updateOrderStatus);

export default router;
