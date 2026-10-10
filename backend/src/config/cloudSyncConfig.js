export function cloudSyncConfig(env = process.env) {
  const enabled = String(env.CLOUD_SYNC_ENABLED || "false").trim().toLowerCase() === "true";
  if (!enabled) return { enabled: false };
  const secret = String(env.CLOUD_SYNC_SECRET || "");
  if (secret.length < 32 || secret.length > 512) throw syncError("SYNC_INVALID_SECRET_CONFIG");
  let url;
  try { url = new URL(env.CLOUD_SYNC_BASE_URL || "https://restaurant-ai-4myq.onrender.com/api"); }
  catch { throw syncError("SYNC_INVALID_URL_CONFIG"); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw syncError("SYNC_INVALID_URL_CONFIG");
  }
  const interval = Number(env.CLOUD_SYNC_INTERVAL_SECONDS || 10);
  if (!Number.isFinite(interval) || interval < 5 || interval > 300) {
    throw syncError("SYNC_INVALID_INTERVAL_CONFIG");
  }
  return { enabled, secret, baseUrl: url.href.replace(/\/+$/, ""), intervalMs: interval * 1000 };
}

export function syncError(code, statusCode = 409) {
  return Object.assign(new Error(code), { code, statusCode });
}

export function syncLog(logger, phase, error, orderId) {
  // Never serialize exception messages, SQL, payloads, phone numbers or headers.
  const code = String(error?.code || "SYNC_RETRY");
  logger.warn("Cloud order sync retry", {
    phase, code: /^[A-Z0-9_]{1,80}$/.test(code) ? code : "SYNC_RETRY",
    ...(Number.isSafeInteger(Number(orderId)) ? { orderId: Number(orderId) } : {}),
  });
}
