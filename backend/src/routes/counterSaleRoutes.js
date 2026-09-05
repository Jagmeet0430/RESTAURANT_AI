import express from "express";

import {
  createCounterSale,
  getCounterSale,
  listCounterSales,
} from "../controllers/barcodeController.js";
import { authMiddleware, authorizeRoles } from "../middleware/index.js";

const router = express.Router();
const operatorRoles = authorizeRoles(["admin", "staff"]);

router.get("/", authMiddleware, operatorRoles, listCounterSales);
router.post("/checkout", authMiddleware, operatorRoles, createCounterSale);
router.get("/:id", authMiddleware, operatorRoles, getCounterSale);

export default router;
