const buckets = new Map();

function clientKey(req, keyPrefix) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = Array.isArray(forwarded)
    ? forwarded[0]
    : String(forwarded || req.ip || req.socket?.remoteAddress || "unknown").split(",")[0];

  return `${keyPrefix}:${ip.trim() || "unknown"}`;
}

export function createRateLimiter({
  windowMs = 60_000,
  max = 30,
  keyPrefix = "route",
  message = "Too many requests. Please wait a moment and try again.",
} = {}) {
  return (req, res, next) => {
    const now = Date.now();
    const key = clientKey(req, keyPrefix);
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      return next();
    }

    bucket.count += 1;

    if (bucket.count > max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({
        success: false,
        message,
      });
    }

    return next();
  };
}
