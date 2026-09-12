import express from "express";

import {
  getReceiptPrinterStatus,
  printKioskOrderReceipt,
  reprintOrderReceipt,
} from "../controllers/receiptPrinterController.js";
import { authMiddleware, authorizeRoles } from "../middleware/index.js";

const router = express.Router();
const operatorRoles = authorizeRoles(["admin", "staff", "manager"]);

router.post("/kiosk/orders/:orderId/receipt", printKioskOrderReceipt);
router.get("/status", authMiddleware, operatorRoles, getReceiptPrinterStatus);
router.post("/orders/:orderId/reprint", authMiddleware, operatorRoles, reprintOrderReceipt);

export default router;
