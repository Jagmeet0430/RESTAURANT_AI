import express from "express";

import { sendWhatsAppOtp, verifyWhatsAppOtp } from "../controllers/whatsappAuthController.js";
import { createRateLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

const otpSendLimiter = createRateLimiter({
  windowMs: 15 * 60_000,
  max: 20,
  keyPrefix: "whatsapp:otp:send",
  message: "Too many OTP requests from this connection. Please wait and try again.",
});

const otpVerifyLimiter = createRateLimiter({
  windowMs: 15 * 60_000,
  max: 30,
  keyPrefix: "whatsapp:otp:verify",
  message: "Too many OTP verification attempts from this connection.",
});

router.post("/send-otp", otpSendLimiter, sendWhatsAppOtp);
router.post("/verify-otp", otpVerifyLimiter, verifyWhatsAppOtp);

export default router;
