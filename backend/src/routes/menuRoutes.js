// Menu Routes

import express from "express";
import { authMiddleware, authorizeRoles } from "../middleware/index.js";
import { getAllMenuItems, getMenuItemById, createMenuItem, updateMenuItem, deleteMenuItem, getCategories, getFeaturedItems } from "../controllers/menuController.js";

const router = express.Router();
const operatorRoles = authorizeRoles(["admin", "staff"]);

// Public routes
router.get("/", getAllMenuItems);
router.get("/categories", getCategories);
router.get("/featured", getFeaturedItems);
router.get("/:id", getMenuItemById);

// Protected routes (requires authentication)
router.post("/", authMiddleware, operatorRoles, createMenuItem);
router.put("/:id", authMiddleware, operatorRoles, updateMenuItem);
router.delete("/:id", authMiddleware, operatorRoles, deleteMenuItem);

export default router;
