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
  sendCustomerOtp,
  verifyCustomerOtp,
  addLoyaltyPoints,
  searchCustomers,
  deleteCustomer,
  getFavorites,
  addFavorite,
  removeFavorite,
} from "../controllers/customersController.js";
import { createRateLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

const otpSendLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 5,
  keyPrefix: "customers:otp:send",
  message: "Too many OTP requests. Please wait a moment and try again.",
});

const otpVerifyLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 10,
  keyPrefix: "customers:otp:verify",
  message: "Too many OTP verification attempts. Please wait a moment and try again.",
});

// Public routes
router.get("/search", searchCustomers);
router.get("/phone/:phone", getCustomerByPhone);
router.get("/email/:email", getCustomerByEmail);
router.post("/", createCustomer);
router.post("/otp/send", otpSendLimiter, sendCustomerOtp);
router.post("/otp/verify", otpVerifyLimiter, verifyCustomerOtp);

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
