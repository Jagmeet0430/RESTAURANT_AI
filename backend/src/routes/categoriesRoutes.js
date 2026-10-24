// Categories Routes

import express from "express";
import { authMiddleware, authorizeRoles } from "../middleware/index.js";
import { localMenuAuthority } from '../controllers/menuSyncController.js';
import {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../controllers/categoriesController.js";

const router = express.Router();
const operatorRoles = authorizeRoles(["admin", "staff"]);

// Public routes
router.get("/", getAllCategories);
router.get("/:id", getCategoryById);

// Protected routes (requires authentication)
router.post("/", authMiddleware, operatorRoles, localMenuAuthority, createCategory);
router.put("/:id", authMiddleware, operatorRoles, localMenuAuthority, updateCategory);
router.delete("/:id", authMiddleware, operatorRoles, localMenuAuthority, deleteCategory);

export default router;
