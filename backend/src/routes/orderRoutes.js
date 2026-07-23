// Order Routes

import express from "express";
import { authMiddleware } from "../middleware/index.js";
import { getAllOrders, getOrderById, createOrder, updateOrderStatus, deleteOrder, getOrdersByStatus, getRecentPublicOrders } from "../controllers/ordersController.js";
import { getTrackedOrder, streamTrackedOrder } from "../controllers/orderTrackingController.js";
import { createRateLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();
const trackingLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 60,
  keyPrefix: "orders:track",
  message: "Too many tracking requests. Please wait and try again.",
});

// Admin routes (requires authentication)
router.get("/", authMiddleware, getAllOrders);
router.get("/status/:status", authMiddleware, getOrdersByStatus);

// Public route to create order (customers)
router.get("/recent/public", getRecentPublicOrders);
router.get("/track/:trackingToken", trackingLimiter, getTrackedOrder);
router.get("/track/:trackingToken/events", trackingLimiter, streamTrackedOrder);
router.post("/", createOrder);

router.get("/:id", authMiddleware, getOrderById);

// Update order status (admin/kitchen)
router.put("/:id", authMiddleware, updateOrderStatus);
router.delete("/:id", authMiddleware, deleteOrder);

export default router;
