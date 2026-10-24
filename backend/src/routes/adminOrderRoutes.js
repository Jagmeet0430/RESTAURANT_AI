import express from "express";

import { authMiddleware, authorizeRoles } from "../middleware/index.js";
import { getAdminOrderNotifications, acknowledgeAdminOrderNotification } from '../controllers/adminOrderNotificationController.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import {
  getAdminOrderStatusHistory,
  patchAdminOrderStatus,
  retryAdminOrderNotification,
} from "../controllers/adminOrderController.js";

const router = express.Router();

const notificationRoles = authorizeRoles(['admin', 'staff']);
const notificationLimiter = createRateLimiter({ windowMs: 60000, max: 120, keyPrefix: 'admin-order-notifications' });
router.get('/notifications', authMiddleware, notificationRoles, notificationLimiter, getAdminOrderNotifications);
router.post('/notifications/:orderId/ack', authMiddleware, notificationRoles, notificationLimiter, acknowledgeAdminOrderNotification);

router.patch("/:orderId/status", authMiddleware, patchAdminOrderStatus);
router.get("/:orderId/status-history", authMiddleware, getAdminOrderStatusHistory);
router.post("/:orderId/notifications/retry", authMiddleware, retryAdminOrderNotification);

export default router;
