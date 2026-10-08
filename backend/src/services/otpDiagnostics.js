import { logger } from "../utils/logger.js";
import { maskPhoneNumber } from "../utils/phoneNumber.js";
import { otpDeliveryChannel } from "../config/messagingConfig.js";

const variables = [
  "WHATSAPP_ENABLED", "OTP_DELIVERY_CHANNEL", "WHATSAPP_PROVIDER", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID",
  "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_NUMBER",
  "SMS_PROVIDER", "TWILIO_SMS_NUMBER", "TWILIO_MESSAGING_SERVICE_SID", "SMS_API_KEY", "SMS_SENDER_ID", "OTP_SECRET", "JWT_SECRET",
  "DATABASE_URL", "DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD",
];

export function logOtpSendFailure(error, { phone = "", stage = "controller", sensitiveValues = [], channel = otpDeliveryChannel() } = {}) {
  const provider = String((channel === "sms" ? process.env.SMS_PROVIDER : process.env.WHATSAPP_PROVIDER) || "unconfigured").toLowerCase();
  const secrets = [
    ...sensitiveValues, String(phone || ""), String(phone || "").replace(/\D/g, ""),
    ...Object.entries(process.env)
      .filter(([key]) => /secret|password|passwd|token|api.?key|database_url|account_sid|phone_number|whatsapp_number/i.test(key))
      .map(([, value]) => value),
  ].filter(Boolean).sort((a, b) => b.length - a.length);

  function clean(value) {
    let text = String(value || "");
    for (const secret of secrets) text = text.split(secret).join("[redacted]");
    return text
      .replace(/(?:https?|postgres(?:ql)?):\/\/\S+/gi, "[redacted-url]")
      .replace(/\b(?:Bearer|Basic)\s+\S+/gi, "[redacted-auth]")
      .replace(/[A-Za-z0-9_+/=-]{32,}/g, "[redacted-value]")
      .replace(/\+?\d[\d\s().-]{4,}\d/g, "[redacted-number]")
      .replace(/[\r\n\t]/g, " ")
      .slice(0, 400);
  }

  logger.error("Customer OTP send failed", {
    stage,
    channel: ["sms", "whatsapp"].includes(channel) ? channel : "unsupported",
    phone: maskPhoneNumber(phone),
    provider: ["meta", "twilio", "mock", "unconfigured"].includes(provider) ? provider : "unsupported",
    errorName: clean(error?.name || "Error"),
    errorMessage: clean(error?.message || "Unknown failure"),
    code: error?.code === undefined ? null
      : /^(?:[a-z][a-z0-9_]{0,39}|[a-z0-9]{5}|\d{3,6})$/i.test(String(error.code)) && !secrets.includes(String(error.code))
        ? String(error.code) : "[redacted]",
    providerStatus: Number.isInteger(error?.providerStatus) ? error.providerStatus : null,
    internationalPhoneFormat: /^\+[1-9]\d{9,14}$/.test(String(phone)),
    fetchAvailable: typeof fetch === "function",
    environment: variables.map(variable => ({ variable, present: Boolean(process.env[variable]) })),
  });
}
