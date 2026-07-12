// Menu Routes

import express from "express";
import { authMiddleware } from "../middleware/index.js";
import { getAllMenuItems, getMenuItemById, createMenuItem, updateMenuItem, deleteMenuItem, getCategories, getFeaturedItems } from "../controllers/menuController.js";

const router = express.Router();

// Public routes
router.get("/", getAllMenuItems);
router.get("/categories", getCategories);
router.get("/featured", getFeaturedItems);
router.get("/:id", getMenuItemById);

// Protected routes (requires authentication)
router.post("/", authMiddleware, createMenuItem);
router.put("/:id", authMiddleware, updateMenuItem);
router.delete("/:id", authMiddleware, deleteMenuItem);

export default router;
