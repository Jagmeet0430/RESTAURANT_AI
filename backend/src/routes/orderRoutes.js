// Order Routes

import express from "express";
import { authMiddleware, authorizeRoles } from "../middleware/index.js";
import { getAllOrders, getOrderById, createOrder, updateOrderStatus, deleteOrder, getOrdersByStatus, getRecentPublicOrders } from "../controllers/ordersController.js";
import { getTrackedOrder, streamTrackedOrder } from "../controllers/orderTrackingController.js";
import { createRateLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();
const orderRoles = authorizeRoles(["admin", "staff", "kitchen_staff"]);
const trackingLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 60,
  keyPrefix: "orders:track",
  message: "Too many tracking requests. Please wait and try again.",
});
const publicOrderLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 5,
  keyPrefix: "orders:create",
  message: "Too many order attempts. Please wait a moment and try again.",
});

// Admin routes (requires authentication)
router.get("/", authMiddleware, orderRoles, getAllOrders);
router.get("/status/:status", authMiddleware, orderRoles, getOrdersByStatus);

// Public route to create order (customers)
router.get("/recent/public", getRecentPublicOrders);
router.get("/track/:trackingToken", trackingLimiter, getTrackedOrder);
router.get("/track/:trackingToken/events", trackingLimiter, streamTrackedOrder);
router.post("/", publicOrderLimiter, createOrder);

router.get("/:id", authMiddleware, orderRoles, getOrderById);

// Update order status (admin/kitchen)
router.put("/:id", authMiddleware, orderRoles, updateOrderStatus);
router.delete("/:id", authMiddleware, orderRoles, deleteOrder);

export default router;
