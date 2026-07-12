// Order Routes

import express from "express";
import { authMiddleware } from "../middleware/index.js";
import { getAllOrders, getOrderById, createOrder, updateOrderStatus, deleteOrder, getOrdersByStatus, getRecentPublicOrders } from "../controllers/ordersController.js";

const router = express.Router();

// Admin routes (requires authentication)
router.get("/", authMiddleware, getAllOrders);
router.get("/status/:status", authMiddleware, getOrdersByStatus);
router.get("/:id", authMiddleware, getOrderById);

// Public route to create order (customers)
router.get("/recent/public", getRecentPublicOrders);
router.post("/", createOrder);

// Update order status (admin/kitchen)
router.put("/:id", authMiddleware, updateOrderStatus);
router.delete("/:id", authMiddleware, deleteOrder);

export default router;
