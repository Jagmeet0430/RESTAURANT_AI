import crypto from "node:crypto";

import { pool } from "../config/database.js";
import { normalizePhoneNumber } from "../utils/phoneNumber.js";
import { sendWhatsAppMessage } from "./whatsappService.js";

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES || 5);
const OTP_RESEND_SECONDS = Number(process.env.OTP_RESEND_SECONDS || 30);
const OTP_TOKEN_EXPIRY_MINUTES = Number(process.env.OTP_TOKEN_EXPIRY_MINUTES || 20);
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);
const OTP_MAX_REQUESTS = Number(process.env.OTP_MAX_REQUESTS || 3);
const OTP_WINDOW_MINUTES = 15;

const otpSecret = () =>
  process.env.OTP_SECRET || process.env.JWT_SECRET || process.env.SESSION_SECRET || "restaurantai-local-otp-secret";

function hmac(value) {
  return crypto.createHmac("sha256", otpSecret()).update(String(value)).digest("hex");
}

function hashOtp(phone, otp) {
  return hmac(`${phone}:${otp}`);
}

function hashToken(token) {
  return hmac(`verification-token:${token}`);
}

function generateOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(OTP_LENGTH, "0");
}

function signPayload(payload) {
  return crypto.createHmac("sha256", otpSecret()).update(payload).digest("base64url");
}

function createSignedToken({ phone, verificationId }) {
  const payload = Buffer.from(
    JSON.stringify({
      phone,
      verificationId,
      jti: crypto.randomBytes(18).toString("base64url"),
      exp: Date.now() + OTP_TOKEN_EXPIRY_MINUTES * 60 * 1000,
    })
  ).toString("base64url");

  return `${payload}.${signPayload(payload)}`;
}

function readSignedToken(token) {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature) return null;

  const expected = signPayload(payload);
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (receivedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (Number(parsed.exp || 0) <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function clientIp(req) {
  const forwarded = req?.headers?.["x-forwarded-for"];
  return String(Array.isArray(forwarded) ? forwarded[0] : forwarded || req?.ip || req?.socket?.remoteAddress || "")
    .split(",")[0]
    .trim()
    .slice(0, 80);
}

export function normalizePhone(phone = "") {
  return normalizePhoneNumber(phone);
}

export async function ensureOtpTable(client = pool) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS phone_verifications (
      id SERIAL PRIMARY KEY,
      phone_number VARCHAR(20) NOT NULL,
      otp_hash TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      verified_at TIMESTAMP,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      request_count INTEGER NOT NULL DEFAULT 1,
      blocked_until TIMESTAMP,
      verification_token_hash TEXT,
      token_used_at TIMESTAMP,
      ip_address VARCHAR(80),
      user_agent TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone_created
    ON phone_verifications(phone_number, created_at DESC)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_phone_verifications_token_hash
    ON phone_verifications(verification_token_hash)
    WHERE verification_token_hash IS NOT NULL
  `);
}

export async function createPhoneOtp(phone, { req = null } = {}) {
  const normalizedPhone = normalizePhoneNumber(phone);
  await ensureOtpTable();

  const recent = await pool.query(
    `SELECT COUNT(*)::int AS count,
            MAX(created_at) AS last_request_at,
            MAX(blocked_until) AS blocked_until
     FROM phone_verifications
     WHERE phone_number = $1
       AND created_at > NOW() - INTERVAL '${OTP_WINDOW_MINUTES} minutes'`,
    [normalizedPhone]
  );

  const blockedUntil = recent.rows[0]?.blocked_until ? new Date(recent.rows[0].blocked_until) : null;
  if (blockedUntil && blockedUntil.getTime() > Date.now()) {
    const error = new Error("Too many OTP attempts. Please try again later.");
    error.statusCode = 429;
    throw error;
  }

  const lastRequestAt = recent.rows[0]?.last_request_at ? new Date(recent.rows[0].last_request_at) : null;
  if (lastRequestAt && Date.now() - lastRequestAt.getTime() < OTP_RESEND_SECONDS * 1000) {
    const error = new Error(`Please wait ${OTP_RESEND_SECONDS} seconds before requesting another OTP.`);
    error.statusCode = 429;
    error.retryAfter = OTP_RESEND_SECONDS;
    throw error;
  }

  const requestCount = Number(recent.rows[0]?.count || 0);
  if (requestCount >= OTP_MAX_REQUESTS) {
    await pool.query(
      `INSERT INTO phone_verifications
         (phone_number, otp_hash, expires_at, request_count, blocked_until, ip_address, user_agent)
       VALUES ($1, $2, NOW(), $3, NOW() + INTERVAL '15 minutes', $4, $5)`,
      [normalizedPhone, "blocked", requestCount + 1, clientIp(req), String(req?.headers?.["user-agent"] || "").slice(0, 500)]
    );
    const error = new Error("Maximum OTP requests reached. Please try again after 15 minutes.");
    error.statusCode = 429;
    throw error;
  }

  const otp = generateOtp();
  const result = await pool.query(
    `INSERT INTO phone_verifications
       (phone_number, otp_hash, expires_at, request_count, ip_address, user_agent)
     VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval, $4, $5, $6)
     RETURNING id, phone_number, expires_at`,
    [
      normalizedPhone,
      hashOtp(normalizedPhone, otp),
      OTP_EXPIRY_MINUTES,
      requestCount + 1,
      clientIp(req),
      String(req?.headers?.["user-agent"] || "").slice(0, 500),
    ]
  );

  try {
    await sendWhatsAppMessage({
      to: normalizedPhone,
      body: `Your MAHESH order verification OTP is ${otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`,
    });
  } catch (error) {
    await pool.query("DELETE FROM phone_verifications WHERE id = $1", [result.rows[0].id]);
    throw error;
  }

  return {
    phone: result.rows[0].phone_number,
    expires_at: result.rows[0].expires_at,
    resend_after_seconds: OTP_RESEND_SECONDS,
  };
}

export async function verifyPhoneOtp({ phone, otp, req = null }) {
  const normalizedPhone = normalizePhoneNumber(phone);
  const cleanOtp = String(otp || "").trim();

  if (!/^\d{6}$/.test(cleanOtp)) {
    const error = new Error("Enter the 6-digit OTP.");
    error.statusCode = 400;
    throw error;
  }

  await ensureOtpTable();

  const result = await pool.query(
    `SELECT id, phone_number, otp_hash, failed_attempts, expires_at, verified_at, blocked_until
     FROM phone_verifications
     WHERE phone_number = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [normalizedPhone]
  );

  if (result.rowCount === 0) {
    const error = new Error("Please send OTP first.");
    error.statusCode = 404;
    throw error;
  }

  const record = result.rows[0];
  const blockedUntil = record.blocked_until ? new Date(record.blocked_until) : null;

  if (blockedUntil && blockedUntil.getTime() > Date.now()) {
    const error = new Error("This phone number is temporarily blocked. Please try again later.");
    error.statusCode = 429;
    throw error;
  }

  if (record.verified_at) {
    const token = createSignedToken({ phone: normalizedPhone, verificationId: record.id });
    await pool.query(
      `UPDATE phone_verifications
       SET verification_token_hash = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [hashToken(token), record.id]
    );
    return { phone: normalizedPhone, verification_token: token };
  }

  if (new Date(record.expires_at).getTime() <= Date.now()) {
    const error = new Error("OTP expired. Please request a new OTP.");
    error.statusCode = 400;
    throw error;
  }

  if (Number(record.failed_attempts) >= OTP_MAX_ATTEMPTS) {
    const error = new Error("Too many wrong OTP attempts. Please request a new OTP later.");
    error.statusCode = 429;
    throw error;
  }

  if (hashOtp(normalizedPhone, cleanOtp) !== record.otp_hash) {
    const nextAttempts = Number(record.failed_attempts) + 1;
    await pool.query(
      `UPDATE phone_verifications
       SET failed_attempts = failed_attempts + 1,
           blocked_until = CASE WHEN $2 >= $3 THEN NOW() + INTERVAL '15 minutes' ELSE blocked_until END,
           ip_address = COALESCE($4, ip_address),
           user_agent = COALESCE($5, user_agent),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [
        record.id,
        nextAttempts,
        OTP_MAX_ATTEMPTS,
        clientIp(req),
        String(req?.headers?.["user-agent"] || "").slice(0, 500) || null,
      ]
    );
    const error = new Error("Incorrect OTP. Please try again.");
    error.statusCode = 400;
    throw error;
  }

  const token = createSignedToken({ phone: normalizedPhone, verificationId: record.id });
  await pool.query(
    `UPDATE phone_verifications
     SET verified_at = COALESCE(verified_at, CURRENT_TIMESTAMP),
         verification_token_hash = $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [hashToken(token), record.id]
  );

  return { phone: normalizedPhone, verification_token: token };
}

export function createPhoneVerificationToken(phone) {
  return createSignedToken({ phone: normalizePhoneNumber(phone), verificationId: null });
}

export function verifyPhoneVerificationToken(phone, token) {
  const payload = readSignedToken(token);
  if (!payload) return false;
  return payload.phone === normalizePhoneNumber(phone);
}

export async function requireVerifiedPhoneToken(phone, token, { client = pool, consume = true, largeOrder = false } = {}) {
  const normalizedPhone = normalizePhoneNumber(phone);
  const payload = readSignedToken(token);

  if (!payload || payload.phone !== normalizedPhone) {
    const error = new Error(
      largeOrder
        ? "Large orders require WhatsApp OTP verification before checkout."
        : "Please verify your WhatsApp number before placing the order."
    );
    error.statusCode = 401;
    throw error;
  }

  const tokenHash = hashToken(token);
  const result = await client.query(
    `SELECT id, token_used_at
     FROM phone_verifications
     WHERE id = $1
       AND phone_number = $2
       AND verification_token_hash = $3
       AND verified_at IS NOT NULL
     LIMIT 1`,
    [payload.verificationId, normalizedPhone, tokenHash]
  );

  if (result.rowCount === 0) {
    const error = new Error("Phone verification token is invalid or expired. Please verify again.");
    error.statusCode = 401;
    throw error;
  }

  if (result.rows[0].token_used_at) {
    const error = new Error("Phone verification token was already used. Please verify again.");
    error.statusCode = 401;
    throw error;
  }

  if (consume) {
    await client.query(
      `UPDATE phone_verifications
       SET token_used_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND token_used_at IS NULL`,
      [result.rows[0].id]
    );
  }

  return true;
}
