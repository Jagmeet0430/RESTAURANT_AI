import express from "express";

import { receiveWhatsAppWebhook, verifyWhatsAppWebhook } from "../controllers/whatsappWebhookController.js";

const router = express.Router();

router.get("/", verifyWhatsAppWebhook);
router.post("/", receiveWhatsAppWebhook);

export default router;
