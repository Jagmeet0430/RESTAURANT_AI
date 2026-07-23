import crypto from "node:crypto";

export function generateTrackingToken() {
  return crypto.randomBytes(32).toString("base64url");
}
