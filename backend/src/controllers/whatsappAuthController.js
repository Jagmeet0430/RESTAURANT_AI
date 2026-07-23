import { successResponse, errorResponse, asyncHandler } from "../utils/index.js";
import { createPhoneOtp, verifyPhoneOtp } from "../services/otpService.js";

export const sendWhatsAppOtp = asyncHandler(async (req, res) => {
  try {
    const otp = await createPhoneOtp(req.body.phone, { req });
    return successResponse(
      res,
      otp,
      "OTP sent to WhatsApp"
    );
  } catch (error) {
    if (error.retryAfter) res.set("Retry-After", String(error.retryAfter));
    return errorResponse(res, error.message, error.statusCode || 500);
  }
});

export const verifyWhatsAppOtp = asyncHandler(async (req, res) => {
  try {
    const verification = await verifyPhoneOtp({
      phone: req.body.phone,
      otp: req.body.otp,
      req,
    });
    return successResponse(res, verification, "Phone verified");
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
});
