const SENSITIVE_KEY_PATTERN = /(password|passwd|pwd|secret|token|authorization|cookie|otp|signature|key|razorpay)/i;
const MAX_STRING_LENGTH = 500;

function redact(value, depth = 0) {
  if (depth > 5) {
    return "[max-depth]";
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      code: value.code,
      statusCode: value.statusCode,
      stack: process.env.NODE_ENV === "production" ? undefined : value.stack,
    };
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => redact(item, depth + 1));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? "[redacted]" : redact(item, depth + 1),
      ])
    );
  }

  if (typeof value === "string" && value.length > MAX_STRING_LENGTH) {
    return `${value.slice(0, MAX_STRING_LENGTH)}...`;
  }

  return value;
}

function write(level, message, meta = {}) {
  const event = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...redact(meta),
  };

  const line = JSON.stringify(event);
  if (level === "error" || level === "fatal") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info(message, meta) {
    write("info", message, meta);
  },
  warn(message, meta) {
    write("warn", message, meta);
  },
  error(message, meta) {
    write("error", message, meta);
  },
  fatal(message, meta) {
    write("fatal", message, meta);
  },
};

export function requestMeta(req) {
  return {
    method: req.method,
    path: req.originalUrl || req.url,
    ip: req.ip || req.socket?.remoteAddress,
    userId: req.user?.id,
    role: req.user?.role,
  };
}
