import express from "express";

import { createCounterSale } from "../controllers/barcodeController.js";
import { authMiddleware } from "../middleware/index.js";

const router = express.Router();

router.post("/checkout", authMiddleware, createCounterSale);

export default router;
