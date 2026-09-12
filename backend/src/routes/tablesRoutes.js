import express from "express";
import { authMiddleware, authorizeRoles } from "../middleware/index.js";
import {
  createTable,
  getAllTables,
  getTableById,
  regenerateTableQr,
  resolvePublicTable,
  updateTable,
} from "../controllers/tablesController.js";

const router = express.Router();
const adminOrManager = authorizeRoles(["admin", "manager"]);

router.get("/public/:token", resolvePublicTable);
router.get("/", authMiddleware, adminOrManager, getAllTables);
router.get("/:id", authMiddleware, adminOrManager, getTableById);
router.post("/", authMiddleware, adminOrManager, createTable);
router.put("/:id", authMiddleware, adminOrManager, updateTable);
router.post("/:id/regenerate-token", authMiddleware, adminOrManager, regenerateTableQr);

export default router;
