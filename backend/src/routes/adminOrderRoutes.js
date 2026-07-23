import express from "express";

import { authMiddleware } from "../middleware/index.js";
import {
  getAdminOrderStatusHistory,
  patchAdminOrderStatus,
  retryAdminOrderNotification,
} from "../controllers/adminOrderController.js";

const router = express.Router();

router.patch("/:orderId/status", authMiddleware, patchAdminOrderStatus);
router.get("/:orderId/status-history", authMiddleware, getAdminOrderStatusHistory);
router.post("/:orderId/notifications/retry", authMiddleware, retryAdminOrderNotification);

export default router;
