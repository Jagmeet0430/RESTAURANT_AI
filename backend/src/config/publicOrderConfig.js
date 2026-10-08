export function publicOrderOtpRequired() {
  // This temporary cloud-testing switch must not relax local restaurant orders.
  if (String(process.env.RESTAURANTAI_MODE || "online").trim().toLowerCase() === "local") return true;
  return String(process.env.PUBLIC_ORDER_OTP_REQUIRED || "true").trim().toLowerCase() !== "false";
}
