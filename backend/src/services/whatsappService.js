const providerName = () => String(process.env.WHATSAPP_PROVIDER || "mock").toLowerCase();

function whatsappNumber(phone) {
  return String(phone || "").replace(/^\+/, "");
}

export async function sendWhatsAppMessage({ to, body, templateName, templateLanguage = "en" }) {
  const provider = providerName();

  if (provider === "meta") {
    if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
      throw Object.assign(new Error("Meta WhatsApp credentials are not configured"), { temporary: false });
    }

    const payload = templateName
      ? {
          messaging_product: "whatsapp",
          to: whatsappNumber(to),
          type: "template",
          template: {
            name: templateName,
            language: { code: templateLanguage },
          },
        }
      : {
          messaging_product: "whatsapp",
          to: whatsappNumber(to),
          type: "text",
          text: { preview_url: false, body },
        };

    const response = await fetch(
      `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(data.error?.message || "Meta WhatsApp send failed");
      error.temporary = response.status >= 500 || response.status === 429;
      throw error;
    }

    return {
      provider,
      providerMessageId: data.messages?.[0]?.id || null,
      deliveryStatus: "sent",
    };
  }

  if (provider === "twilio") {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_WHATSAPP_NUMBER) {
      throw Object.assign(new Error("Twilio WhatsApp credentials are not configured"), { temporary: false });
    }

    const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
    const form = new URLSearchParams({
      From: process.env.TWILIO_WHATSAPP_NUMBER,
      To: `whatsapp:${to}`,
      Body: body,
    });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
      }
    );
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(data.message || "Twilio WhatsApp send failed");
      error.temporary = response.status >= 500 || response.status === 429;
      throw error;
    }

    return {
      provider,
      providerMessageId: data.sid || null,
      deliveryStatus: data.status || "sent",
    };
  }

  if (process.env.NODE_ENV === "production") {
    throw Object.assign(new Error("WHATSAPP_PROVIDER must be meta or twilio in production"), { temporary: false });
  }

  const safeBody = String(body || "").replace(/\b\d{6}\b/g, "******");
  console.log(`WhatsApp mock message to ${to}: ${safeBody}`);
  return {
    provider: "mock",
    providerMessageId: `mock-${Date.now()}`,
    deliveryStatus: "sent",
  };
}
