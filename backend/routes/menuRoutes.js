import express from "express";
import { authMiddleware } from "../src/middleware/index.js";
import {
  getAllMenuItems,
  getMenuItemById,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  getCategories,
  getFeaturedItems,
} from "../src/controllers/menuController.js";

const router = express.Router();

router.get("/", getAllMenuItems);
router.get("/categories", getCategories);
router.get("/featured", getFeaturedItems);
router.get("/:id", getMenuItemById);
router.post("/", authMiddleware, createMenuItem);
router.put("/:id", authMiddleware, updateMenuItem);
router.delete("/:id", authMiddleware, deleteMenuItem);

export default router;
