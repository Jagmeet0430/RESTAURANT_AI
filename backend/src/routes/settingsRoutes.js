import express from "express";
import { authMiddleware, authorizeRoles } from "../middleware/index.js";
import { getPublicSettings, getSettings, updateSettings } from "../controllers/settingsController.js";

const router = express.Router();

router.get("/public", getPublicSettings);
router.get("/", authMiddleware, authorizeRoles(["admin"]), getSettings);
router.put("/", authMiddleware, authorizeRoles(["admin"]), updateSettings);

export default router;
