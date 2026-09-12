import { pool } from "../config/database.js";
import { asyncHandler, errorResponse, successResponse } from "../utils/index.js";
import {
  getPrinterStatus,
  printOrderReceipt,
} from "../services/receiptPrinterService.js";

const isPrivateLanAddress = (address = "") => {
  const ip = String(address || "")
    .replace(/^::ffff:/, "")
    .replace(/^\[|\]$/g, "");

  return (
    ip === "::1" ||
    ip === "127.0.0.1" ||
    ip === "localhost" ||
    ip.startsWith("127.") ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  );
};

function ensureTrustedPrintRequest(req) {
  if (isPrivateLanAddress(req.ip) || isPrivateLanAddress(req.socket?.remoteAddress)) {
    return;
  }

  const error = new Error("Receipt printing is available only from this local restaurant network");
  error.statusCode = 403;
  throw error;
}

function parseOrderId(value) {
  const orderId = Number(value);
  if (!Number.isInteger(orderId) || orderId < 1) {
    const error = new Error("Invalid order ID");
    error.statusCode = 400;
    throw error;
  }
  return orderId;
}

export const getReceiptPrinterStatus = asyncHandler(async (req, res) => {
  const status = await getPrinterStatus();
  return successResponse(res, status, "Receipt printer status retrieved");
});

export const printKioskOrderReceipt = asyncHandler(async (req, res) => {
  try {
    ensureTrustedPrintRequest(req);
    const orderId = parseOrderId(req.params.orderId);
    const result = await printOrderReceipt(pool, orderId, { source: "kiosk" });
    return successResponse(res, result, result.printed ? "Receipt printed" : "Receipt print skipped");
  } catch (error) {
    return errorResponse(res, error.message || "Unable to print receipt", error.statusCode || 500);
  }
});

export const reprintOrderReceipt = asyncHandler(async (req, res) => {
  try {
    const orderId = parseOrderId(req.params.orderId);
    const result = await printOrderReceipt(pool, orderId, {
      source: "manual_reprint",
      force: true,
      duplicate: true,
    });
    return successResponse(res, result, result.printed ? "Receipt reprinted" : "Receipt reprint skipped");
  } catch (error) {
    return errorResponse(res, error.message || "Unable to reprint receipt", error.statusCode || 500);
  }
});
