import express from "express";
import { authMiddleware, authorizeRoles } from "../middleware/index.js";
import { getPublicSettings, getSettings, updateSettings, getOrderNotificationSettings } from "../controllers/settingsController.js";

const router = express.Router();

router.get("/public", getPublicSettings);
router.get('/order-notifications', authMiddleware, authorizeRoles(['admin', 'staff']), getOrderNotificationSettings);
router.get("/", authMiddleware, authorizeRoles(["admin"]), getSettings);
router.put("/", authMiddleware, authorizeRoles(["admin"]), updateSettings);

export default router;
