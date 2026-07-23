import { asyncHandler } from "../utils/index.js";
import { updateWhatsAppDeliveryStatus } from "../services/notificationService.js";

export const verifyWhatsAppWebhook = asyncHandler(async (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.status(403).json({ success: false, message: "Invalid WhatsApp webhook verification token" });
});

export const receiveWhatsAppWebhook = asyncHandler(async (req, res) => {
  const statuses = req.body?.entry
    ?.flatMap((entry) => entry.changes || [])
    ?.flatMap((change) => change.value?.statuses || []) || [];

  for (const status of statuses) {
    await updateWhatsAppDeliveryStatus({
      providerMessageId: status.id,
      deliveryStatus: status.status,
      errorMessage: status.errors?.[0]?.title || null,
    });
  }

  return res.json({ success: true });
});
