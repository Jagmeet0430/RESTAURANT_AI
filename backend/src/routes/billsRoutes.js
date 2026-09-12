import express from "express";

import {
  closeBillingEndOfDay,
  getBillById,
  getBillingEndOfDay,
  getBillingSettlementHistory,
  getBills,
  getReceiptBySource,
  getTableSettlements,
  markOrderPaidFromBills,
  settleTableFromBills,
} from "../controllers/billsController.js";
import { authMiddleware, authorizeRoles } from "../middleware/index.js";

const router = express.Router();
const billingRoles = authorizeRoles(["admin", "staff", "manager"]);

router.use(authMiddleware, billingRoles);

router.get("/", getBills);
router.get("/end-of-day", getBillingEndOfDay);
router.get("/end-of-day/history", getBillingSettlementHistory);
router.post("/end-of-day/close", closeBillingEndOfDay);
router.get("/tables/due", getTableSettlements);
router.post("/orders/:orderId/pay", markOrderPaidFromBills);
router.post("/tables/:tableId/settle", settleTableFromBills);
router.post("/tables/settle", settleTableFromBills);
router.get("/receipt/:source/:id", getReceiptBySource);
router.get("/:id", getBillById);

export default router;
