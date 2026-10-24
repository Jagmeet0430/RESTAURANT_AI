// Menu Routes

import express from "express";
import { authMiddleware, authorizeRoles } from "../middleware/index.js";
import { getAllMenuItems, getMenuItemById, createMenuItem, updateMenuItem, deleteMenuItem, getCategories, getFeaturedItems } from "../controllers/menuController.js";
import { getMenuVersion, getMenuImage, getMenuSyncStatus, retryMenuSync, localMenuAuthority } from '../controllers/menuSyncController.js';

const router = express.Router();
const operatorRoles = authorizeRoles(["admin", "staff"]);

// Public routes
router.get("/", getAllMenuItems);
router.get('/version', getMenuVersion);
router.get('/images/:asset', getMenuImage);
router.get('/sync/status', authMiddleware, operatorRoles, getMenuSyncStatus);
router.post('/sync/retry', authMiddleware, operatorRoles, retryMenuSync);
router.get("/categories", getCategories);
router.get("/featured", getFeaturedItems);
router.get("/:id", getMenuItemById);

// Protected routes (requires authentication)
router.post("/", authMiddleware, operatorRoles, localMenuAuthority, createMenuItem);
router.put("/:id", authMiddleware, operatorRoles, localMenuAuthority, updateMenuItem);
router.delete("/:id", authMiddleware, operatorRoles, localMenuAuthority, deleteMenuItem);

export default router;
