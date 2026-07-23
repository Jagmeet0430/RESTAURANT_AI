import test from "node:test";
import assert from "node:assert/strict";

import { normalizePhoneNumber, maskPhoneNumber } from "../src/utils/phoneNumber.js";

process.env.ALLOWED_EXTENSIONS ||= "jpg,jpeg,png,gif,webp";
process.env.JWT_SECRET ||= "test-secret";

let statusService;

async function orderStatusService() {
  statusService ||= await import("../src/services/orderStatusService.js");
  return statusService;
}

test("normalizes Indian mobile numbers to +91 format", () => {
  assert.equal(normalizePhoneNumber("6283847237"), "+916283847237");
  assert.equal(normalizePhoneNumber("+91 62838 47237"), "+916283847237");
});

test("rejects disposable-looking phone numbers", () => {
  assert.throws(() => normalizePhoneNumber("0000000000"), /valid/);
  assert.throws(() => normalizePhoneNumber("12345"), /valid|required|international/);
});

test("masks customer phone numbers for public tracking", () => {
  assert.equal(maskPhoneNumber("+916283847237"), "********7237");
});

test("allows valid pickup status transitions", async () => {
  const { assertValidStatusTransition } = await orderStatusService();
  assert.equal(assertValidStatusTransition("Confirmed", "Accepted", "pickup"), "accepted");
  assert.equal(assertValidStatusTransition("Preparing", "Ready", "pickup"), "ready");
  assert.equal(assertValidStatusTransition("Ready", "Completed", "pickup"), "completed");
});

test("blocks invalid terminal status transitions", async () => {
  const { assertValidStatusTransition } = await orderStatusService();
  assert.throws(() => assertValidStatusTransition("Completed", "Preparing", "pickup"), /Cannot move/);
  assert.throws(() => assertValidStatusTransition("Cancelled", "Accepted", "delivery"), /Cannot move/);
});
