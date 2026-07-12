// Customers Routes

import express from "express";
import { authMiddleware } from "../middleware/index.js";
import {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  getCustomerByPhone,
  getCustomerByEmail,
  addLoyaltyPoints,
  searchCustomers,
  deleteCustomer,
  getFavorites,
  addFavorite,
  removeFavorite,
} from "../controllers/customersController.js";

const router = express.Router();

// Public routes
router.get("/search", searchCustomers);
router.get("/phone/:phone", getCustomerByPhone);
router.get("/email/:email", getCustomerByEmail);
router.post("/", createCustomer);

// Admin routes (requires authentication)
router.get("/", authMiddleware, getAllCustomers);
router.get("/:id", authMiddleware, getCustomerById);
router.get("/:id/favorites", authMiddleware, getFavorites);
router.put("/:id", authMiddleware, updateCustomer);
router.delete("/:id", authMiddleware, deleteCustomer);
router.post("/:id/loyalty", authMiddleware, addLoyaltyPoints);
router.post("/:id/favorites", authMiddleware, addFavorite);
router.delete("/:id/favorites/:menuId", authMiddleware, removeFavorite);

export default router;
