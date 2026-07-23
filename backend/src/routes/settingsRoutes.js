import express from "express";
import { authMiddleware } from "../middleware/index.js";
import { getPublicSettings, getSettings, updateSettings } from "../controllers/settingsController.js";

const router = express.Router();

router.get("/public", getPublicSettings);
router.get("/", authMiddleware, getSettings);
router.put("/", authMiddleware, updateSettings);

export default router;
