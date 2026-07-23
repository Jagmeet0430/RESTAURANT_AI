export function normalizePhoneNumber(phone = "") {
  const raw = String(phone || "").trim();
  const digits = raw.replace(/\D/g, "");

  if (!digits) {
    const error = new Error("Phone number is required");
    error.statusCode = 400;
    throw error;
  }

  if (/^(\d)\1+$/.test(digits) || digits.length < 10 || digits.length > 15) {
    const error = new Error("Enter a valid phone number");
    error.statusCode = 400;
    throw error;
  }

  if (digits.length === 10) {
    if (!/^[6-9]\d{9}$/.test(digits)) {
      const error = new Error("Enter a valid Indian mobile number");
      error.statusCode = 400;
      throw error;
    }
    return `+91${digits}`;
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    const national = digits.slice(2);
    if (!/^[6-9]\d{9}$/.test(national)) {
      const error = new Error("Enter a valid Indian mobile number");
      error.statusCode = 400;
      throw error;
    }
    return `+${digits}`;
  }

  if (raw.startsWith("+") && /^\+\d{10,15}$/.test(`+${digits}`)) {
    return `+${digits}`;
  }

  const error = new Error("Use international format, for example +916283847237");
  error.statusCode = 400;
  throw error;
}

export function maskPhoneNumber(phone = "") {
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length < 4) return "******";
  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}
