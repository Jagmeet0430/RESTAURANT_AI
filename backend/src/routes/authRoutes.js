// Authentication Routes

import express from "express";
import { authMiddleware } from "../middleware/index.js";
import { register, login, logout, verifyToken, refreshToken, getProfile } from "../controllers/authController.js";
import { createRateLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();
const authLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 10,
  keyPrefix: "auth",
  message: "Too many authentication attempts. Please wait and try again.",
});
const tokenLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 30,
  keyPrefix: "auth:token",
});

// Public routes
router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/logout", logout);
router.post("/refresh", tokenLimiter, refreshToken);
router.get("/verify", tokenLimiter, verifyToken);

// Protected routes
router.get("/profile", authMiddleware, getProfile);

export default router;
