import express from "express";

import {
  getReceiptPrinterStatus,
  printKioskOrderReceipt,
  reprintOrderReceipt,
} from "../controllers/receiptPrinterController.js";
import { authMiddleware, authorizeRoles } from "../middleware/index.js";
import { pool } from '../config/database.js';
import { asyncHandler, successResponse, errorResponse } from '../utils/index.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import { getPrinterManagement, savePrinterSettings, previewSavedReceipt, printSavedReceipt } from '../services/printerManagementService.js';

const router = express.Router();
const operatorRoles = authorizeRoles(["admin", "staff", "manager"]);
const adminOnly = authorizeRoles(['admin']);
const printLimiter = createRateLimiter({ windowMs: 60000, max: 12, keyPrefix: 'receipt-print' });
const endpoint = action => asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try { return successResponse(res, await action(req)); }
  catch (error) { return errorResponse(res, error.statusCode ? error.message : 'Printer request failed. Check the backend printer connection.', error.statusCode || 500); }
});

router.get('/settings', authMiddleware, adminOnly, endpoint(() => getPrinterManagement()));
router.put('/settings', authMiddleware, adminOnly, endpoint(req => savePrinterSettings(req.body)));
router.post('/test', authMiddleware, adminOnly, printLimiter, endpoint(req => printSavedReceipt(pool, 'test', 'preview', req.body.requestId)));
router.get('/preview/:source/:id', authMiddleware, operatorRoles, endpoint(req => previewSavedReceipt(pool, req.params.source, req.params.id)));
router.post('/print/:source/:id', authMiddleware, operatorRoles, printLimiter, endpoint(req => {
  if (req.params.source === 'test' && req.user?.role !== 'admin') {
    throw Object.assign(new Error('Only an Admin can print test receipts.'), { statusCode: 403 });
  }
  return printSavedReceipt(pool, req.params.source, req.params.id, req.body.requestId);
}));

router.post("/kiosk/orders/:orderId/receipt", printKioskOrderReceipt);
router.get("/status", authMiddleware, operatorRoles, getReceiptPrinterStatus);
router.post("/orders/:orderId/reprint", authMiddleware, operatorRoles, reprintOrderReceipt);

export default router;
