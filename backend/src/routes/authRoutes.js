// Authentication Routes

import express from "express";
import { authMiddleware } from "../middleware/index.js";
import { register, login, logout, verifyToken, refreshToken, getProfile } from "../controllers/authController.js";

const router = express.Router();

// Public routes
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.post("/refresh", refreshToken);
router.get("/verify", verifyToken);

// Protected routes
router.get("/profile", authMiddleware, getProfile);

export default router;
