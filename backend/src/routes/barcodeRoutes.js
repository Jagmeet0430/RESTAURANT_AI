import express from "express";

import { authMiddleware, authorizeRoles } from "../middleware/index.js";
import {
  createCounterSale,
  createStockInScan,
  lookupBarcodeProduct,
} from "../controllers/barcodeController.js";

const router = express.Router();
const operatorRoles = authorizeRoles(["admin", "staff"]);

router.get("/:barcode", authMiddleware, operatorRoles, lookupBarcodeProduct);
router.post("/sales/counter", authMiddleware, operatorRoles, createCounterSale);
router.post("/stock-in", authMiddleware, operatorRoles, createStockInScan);

export default router;
