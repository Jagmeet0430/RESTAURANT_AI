export function isWhatsAppEnabled() {
  const flag = process.env.WHATSAPP_ENABLED;
  if (flag !== undefined && flag !== "") return /^(true|1|yes|on)$/i.test(flag.trim());
  // Existing installations with a configured provider retain their integration.
  return Boolean(process.env.WHATSAPP_PROVIDER);
}

export function validateWhatsAppConfiguration() {
  if (!isWhatsAppEnabled()) return;
  const provider = String(process.env.WHATSAPP_PROVIDER || "").toLowerCase();
  const legacyDevelopmentMock = !process.env.WHATSAPP_ENABLED &&
    process.env.NODE_ENV !== "production" && provider === "mock";
  if (!["meta", "twilio"].includes(provider) && !legacyDevelopmentMock) {
    throw Object.assign(new Error("Enabled WhatsApp requires WHATSAPP_PROVIDER=meta or twilio"), {
      code: "WHATSAPP_CONFIG_INVALID", temporary: false,
    });
  }
}

export function otpDeliveryChannel() {
  return String(process.env.OTP_DELIVERY_CHANNEL ||
    (process.env.SMS_PROVIDER || !isWhatsAppEnabled() ? "sms" : "whatsapp")).toLowerCase();
}
