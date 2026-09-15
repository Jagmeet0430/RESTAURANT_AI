import express from "express";

import {
  createCashOrder,
  createPaymentOrder,
  getPaymentMethods,
  markOrderPaid,
  verifyPayment,
} from "../controllers/paymentController.js";
import { createRateLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

const createOrderLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 5,
  keyPrefix: "payments:create",
  message: "Too many order attempts. Please wait a moment and try again.",
});

const verifyLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 30,
  keyPrefix: "payments:verify",
});

router.get("/methods", getPaymentMethods);
router.post("/create-order", createOrderLimiter, createPaymentOrder);
router.post("/verify", verifyLimiter, verifyPayment);
router.post("/cash-order", createOrderLimiter, createCashOrder);
router.patch("/:orderId/mark-paid", markOrderPaid);

export default router;
