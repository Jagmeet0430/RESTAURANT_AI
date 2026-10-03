import { pool } from "../config/database.js";
import { printOrderReceipt } from "./receiptPrinterService.js";
import { logger } from "../utils/logger.js";

export function normalizeReceiptOrderSource(value = "") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (normalized === "customer_kiosk" || normalized === "self_order_kiosk") return "kiosk";
  return normalized;
}

export function isKioskOrder(order = {}) {
  return normalizeReceiptOrderSource(order.order_source || order.source) === "kiosk";
}

export function requestKioskReceiptAutoPrint(order, { reason = "order_created" } = {}) {
  const orderId = Number(order?.id || order?.order_id || order?.restaurant_order_id);
  const orderSource = normalizeReceiptOrderSource(order?.order_source || order?.source);

  if (!Number.isInteger(orderId) || orderId < 1) {
    logger.warn("Kiosk receipt auto-print skipped: invalid order id", { orderId: order?.id || null, orderSource, reason });
    return false;
  }

  if (orderSource !== "kiosk") {
    return false;
  }

  logger.info("Kiosk receipt auto-print started", { orderId, orderSource, reason });

  printOrderReceipt(pool, orderId, { source: "kiosk" })
    .then((result) => {
      if (result?.printed) {
        logger.info("Kiosk receipt auto-print succeeded", {
          orderId,
          orderSource,
          printerName: result.printerName,
          paperWidth: result.paperWidth,
          copies: result.copies,
        });
        return;
      }

      if (result?.failed) {
        logger.error("Kiosk receipt auto-print failed", {
          orderId,
          orderSource,
          reason,
          errorMessage: result.message || "Receipt printer failed",
          printerName: result.printerName || "",
        });
        return;
      }

      logger.info("Kiosk receipt auto-print skipped", {
        orderId,
        orderSource,
        skipped: Boolean(result?.skipped),
        duplicate: Boolean(result?.duplicate),
        reason: result?.reason || "",
      });
    })
    .catch((error) => {
      logger.error("Kiosk receipt auto-print failed", {
        orderId,
        orderSource,
        reason,
        error,
      });
    });

  return true;
}
