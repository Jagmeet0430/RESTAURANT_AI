import { isWhatsAppEnabled, otpDeliveryChannel } from "../config/messagingConfig.js";
import { sendWhatsAppMessage } from "./whatsappService.js";
import { sendTwilioMessage } from "./twilioMessageService.js";

const unavailable = message => Object.assign(new Error(message), {
  code: "OTP_DELIVERY_NOT_CONFIGURED", statusCode: 503,
});

export async function sendOtpMessage({ to, body, channel = otpDeliveryChannel() }) {
  if (channel === "whatsapp") {
    if (!isWhatsAppEnabled()) throw unavailable("WhatsApp OTP delivery is disabled; configure SMS delivery");
    return sendWhatsAppMessage({ to, body });
  }
  if (channel !== "sms") throw unavailable("OTP_DELIVERY_CHANNEL must be sms or whatsapp");
  if (String(process.env.SMS_PROVIDER || "").toLowerCase() !== "twilio") {
    throw unavailable("SMS_PROVIDER=twilio is required for SMS OTP delivery");
  }
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN ||
      (!process.env.TWILIO_SMS_NUMBER && !process.env.TWILIO_MESSAGING_SERVICE_SID)) {
    throw unavailable("Twilio SMS credentials and sender are not configured");
  }
  if (process.env.TWILIO_SMS_NUMBER?.startsWith("whatsapp:")) {
    throw unavailable("TWILIO_SMS_NUMBER must be an SMS sender, not a WhatsApp sender");
  }
  const result = await sendTwilioMessage({
    to, body, from: process.env.TWILIO_SMS_NUMBER,
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
  });
  if (!result.providerMessageId || ["failed", "undelivered", "canceled"].includes(result.deliveryStatus)) {
    throw Object.assign(new Error("SMS provider did not accept OTP delivery"), { code: "SMS_DELIVERY_REJECTED" });
  }
  return result;
}
