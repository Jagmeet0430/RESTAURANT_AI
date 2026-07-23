import express from "express";

import { authMiddleware } from "../middleware/index.js";
import {
  createCounterSale,
  createStockInScan,
  lookupBarcodeProduct,
} from "../controllers/barcodeController.js";

const router = express.Router();

router.get("/:barcode", authMiddleware, lookupBarcodeProduct);
router.post("/sales/counter", authMiddleware, createCounterSale);
router.post("/stock-in", authMiddleware, createStockInScan);

export default router;
