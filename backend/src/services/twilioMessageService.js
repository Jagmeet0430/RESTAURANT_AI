export async function sendTwilioMessage({ to, body, from, messagingServiceSid }) {
  const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
  const form = new URLSearchParams({ To: to, Body: body });
  if (messagingServiceSid) form.set("MessagingServiceSid", messagingServiceSid);
  else form.set("From", from);
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "Twilio message send failed");
    error.code = data.code;
    error.providerStatus = response.status;
    error.temporary = response.status >= 500 || response.status === 429;
    throw error;
  }
  return { provider: "twilio", providerMessageId: data.sid || null, deliveryStatus: data.status || "sent" };
}
