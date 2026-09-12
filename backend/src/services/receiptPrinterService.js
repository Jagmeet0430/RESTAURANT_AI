import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { getOrderReceipt, getTestReceipt } from "./billingService.js";
import { logger } from "../utils/logger.js";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_PRINTER_CONFIG = {
  enabled: false,
  printerName: "",
  paperWidth: "80mm",
  copies: 1,
  autoPrintKioskOrders: true,
};

const printLocks = new Set();

function programDataRoot() {
  if (process.env.RESTAURANTAI_PRINTER_STATE_ROOT) {
    return path.resolve(process.env.RESTAURANTAI_PRINTER_STATE_ROOT);
  }

  if (process.platform === "win32" && process.env.ProgramData) {
    return path.join(process.env.ProgramData, "RestaurantAI");
  }

  return path.resolve(process.cwd(), "..");
}

export function getPrinterConfigPath() {
  return process.env.RESTAURANTAI_PRINTER_CONFIG
    ? path.resolve(process.env.RESTAURANTAI_PRINTER_CONFIG)
    : path.join(programDataRoot(), "config", "printer.json");
}

function runtimePath(...segments) {
  return path.join(programDataRoot(), "runtime", ...segments);
}

async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") {
      logger.warn("Could not read JSON file", { filePath, error });
    }
    return fallback;
  }
}

async function writeJsonFile(filePath, payload) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, filePath);
}

function cleanPrinterConfig(raw = {}) {
  const paperWidth = String(raw.paperWidth || DEFAULT_PRINTER_CONFIG.paperWidth).toLowerCase();
  const copies = Number(raw.copies || DEFAULT_PRINTER_CONFIG.copies);

  return {
    enabled: Boolean(raw.enabled),
    printerName: String(raw.printerName || "").trim(),
    paperWidth: paperWidth === "58mm" ? "58mm" : "80mm",
    copies: Number.isInteger(copies) && copies > 0 && copies <= 5 ? copies : DEFAULT_PRINTER_CONFIG.copies,
    autoPrintKioskOrders:
      raw.autoPrintKioskOrders === undefined ? DEFAULT_PRINTER_CONFIG.autoPrintKioskOrders : Boolean(raw.autoPrintKioskOrders),
  };
}

export async function getPrinterConfig() {
  const configPath = getPrinterConfigPath();
  return {
    configPath,
    config: cleanPrinterConfig(await readJsonFile(configPath, DEFAULT_PRINTER_CONFIG)),
  };
}

function printStorePath() {
  return runtimePath("receipt-print-records.json");
}

async function readPrintStore() {
  const store = await readJsonFile(printStorePath(), { receipts: {} });
  return {
    receipts: store && typeof store.receipts === "object" && store.receipts ? store.receipts : {},
  };
}

async function writePrintStore(store) {
  await writeJsonFile(printStorePath(), store);
}

function printedRecordKey(orderId) {
  return `kiosk-order:${Number(orderId)}`;
}

async function getPrintedRecord(orderId) {
  const store = await readPrintStore();
  return store.receipts[printedRecordKey(orderId)] || null;
}

async function markPrintAttempt(orderId, details) {
  const store = await readPrintStore();
  const key = printedRecordKey(orderId);
  store.receipts[key] = {
    ...(store.receipts[key] || {}),
    ...details,
    orderId: Number(orderId),
    updatedAt: new Date().toISOString(),
  };
  await writePrintStore(store);
}

function candidatePrintScriptPaths() {
  return [
    process.env.RESTAURANTAI_PRINT_SCRIPT,
    path.resolve(process.cwd(), "scripts", "print-receipt.ps1"),
    path.resolve(process.cwd(), "..", "scripts", "print-receipt.ps1"),
    path.resolve(process.cwd(), "..", "..", "scripts", "print-receipt.ps1"),
    path.resolve(process.cwd(), "..", "..", "..", "scripts", "print-receipt.ps1"),
    path.resolve(__dirname, "..", "..", "..", "scripts", "print-receipt.ps1"),
    path.resolve(__dirname, "..", "..", "..", "..", "..", "scripts", "print-receipt.ps1"),
  ].filter(Boolean);
}

async function resolvePrintScriptPath() {
  for (const candidate of candidatePrintScriptPaths()) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next packaged/dev location.
    }
  }

  const error = new Error("Receipt print script not found");
  error.statusCode = 500;
  throw error;
}

function money(value) {
  return Number(value || 0).toFixed(2);
}

function center(text, width) {
  const clean = String(text || "").trim();
  if (clean.length >= width) return clean.slice(0, width);
  const left = Math.floor((width - clean.length) / 2);
  return `${" ".repeat(left)}${clean}`;
}

function row(left, right, width) {
  const leftText = String(left || "");
  const rightText = String(right || "");
  const gap = Math.max(1, width - leftText.length - rightText.length);
  return `${leftText.slice(0, Math.max(0, width - rightText.length - 1))}${" ".repeat(gap)}${rightText}`;
}

function wrap(text, width) {
  const words = String(text || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines = [];
  let line = "";

  for (const word of words) {
    if (!line) {
      line = word;
    } else if (`${line} ${word}`.length <= width) {
      line = `${line} ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
  }

  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function labelOrderType(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("dine")) return "Dine-in";
  if (text.includes("delivery")) return "Delivery";
  if (text.includes("counter_sale")) return "Counter sale";
  if (text.includes("test")) return "Test";
  return "Takeaway";
}

function receiptDate(value) {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const day = String(safeDate.getDate()).padStart(2, "0");
  const month = String(safeDate.getMonth() + 1).padStart(2, "0");
  const year = safeDate.getFullYear();
  const hour24 = safeDate.getHours();
  const hour12 = hour24 % 12 || 12;
  const minutes = String(safeDate.getMinutes()).padStart(2, "0");
  const period = hour24 >= 12 ? "PM" : "AM";
  return `${day}/${month}/${year} ${String(hour12).padStart(2, "0")}:${minutes} ${period}`;
}

export function buildThermalReceiptLayout(receipt, config = {}, { duplicate = false } = {}) {
  const restaurant = receipt.restaurant || {};
  const totals = receipt.totals || {};
  const restaurantName =
    restaurant.restaurant_name || restaurant.restaurantName || restaurant.name || "Restaurant";
  const footer = restaurant.footer_text || restaurant.footer || restaurant.receiptFooter || "Thank you!";
  const orderIdentifier = receipt.order_number || receipt.bill_number || receipt.source_id || "";
  const layout = [
    { type: "text", text: restaurantName, align: "center", style: "header" },
  ];

  if (duplicate) layout.push({ type: "text", text: "DUPLICATE / REPRINT", align: "center", style: "bold" });
  if (restaurant.address) layout.push({ type: "text", text: restaurant.address, align: "center", style: "normal" });
  if (restaurant.phone) layout.push({ type: "text", text: `Phone: ${restaurant.phone}`, align: "center", style: "normal" });
  if (restaurant.gstin || restaurant.gst) {
    layout.push({ type: "text", text: `GSTIN: ${restaurant.gstin || restaurant.gst}`, align: "center", style: "normal" });
  }

  layout.push({ type: "rule" });
  layout.push({ type: "text", text: "Order:", align: "left", style: "bold" });
  layout.push({ type: "text", text: String(orderIdentifier), align: "left", style: "normal" });
  if (receipt.token_number) {
    layout.push({ type: "text", text: `TOKEN: ${receipt.token_number}`, align: "center", style: "token" });
  }
  layout.push({ type: "text", text: `Date: ${receiptDate(receipt.created_at)}`, align: "left", style: "normal" });
  layout.push({ type: "text", text: `Type: ${labelOrderType(receipt.order_type)}`, align: "left", style: "normal" });
  if (receipt.table_number) {
    layout.push({ type: "text", text: `Table: ${receipt.table_number}`, align: "left", style: "bold" });
  }
  if (receipt.customer_name) {
    layout.push({ type: "text", text: "Name:", align: "left", style: "bold" });
    layout.push({ type: "text", text: receipt.customer_name, align: "left", style: "normal" });
  }
  if (receipt.customer_phone) {
    layout.push({ type: "text", text: "Phone:", align: "left", style: "bold" });
    layout.push({ type: "text", text: receipt.customer_phone, align: "left", style: "normal" });
  }
  layout.push({ type: "rule" });

  for (const item of receipt.items || []) {
    const qty = Number(item.quantity || item.qty || 0);
    const unit = Number(item.unit_price || item.price || 0);
    const total = Number(item.total_price || item.line_total || qty * unit || 0);
    layout.push({ type: "text", text: item.name || "Item", align: "left", style: "bold" });
    layout.push({
      type: "pair",
      left: `${qty} x Rs. ${money(unit)}`,
      right: `Rs. ${money(total)}`,
      style: "normal",
    });
    layout.push({ type: "spacer", points: 2 });
  }

  layout.push({ type: "rule" });
  layout.push({ type: "pair", left: "Subtotal", right: `Rs. ${money(totals.subtotal)}`, style: "normal" });
  layout.push({ type: "pair", left: "GST", right: `Rs. ${money(totals.tax)}`, style: "normal" });
  layout.push({ type: "pair", left: "Packing", right: `Rs. ${money(totals.packing)}`, style: "normal" });
  if (Number(totals.discount || 0) > 0) {
    layout.push({ type: "pair", left: "Discount", right: `-Rs. ${money(totals.discount)}`, style: "normal" });
  }
  layout.push({ type: "rule" });
  layout.push({
    type: "pair",
    left: "TOTAL",
    right: `Rs. ${money(totals.grand_total ?? totals.total_amount)}`,
    style: "total",
  });
  layout.push({ type: "rule" });
  layout.push({ type: "text", text: `Payment: ${receipt.payment_method || "Pay at Counter"}`, align: "left", style: "normal" });
  layout.push({ type: "text", text: `Status: ${receipt.payment_status || "Pending"}`, align: "left", style: "normal" });
  layout.push({ type: "rule" });
  layout.push({ type: "text", text: footer, align: "center", style: "bold" });
  if (!/visit again/i.test(footer)) {
    layout.push({ type: "text", text: "Please visit again.", align: "center", style: "normal" });
  }
  layout.push({ type: "text", text: "Powered by RestaurantAI", align: "center", style: "small" });

  return layout;
}

export function buildThermalReceiptText(receipt, config = {}, options = {}) {
  const width = config.paperWidth === "58mm" ? 28 : 42;
  const rule = "-".repeat(width);
  const lines = [];

  for (const entry of buildThermalReceiptLayout(receipt, config, options)) {
    if (entry.type === "rule") {
      lines.push(rule);
    } else if (entry.type === "spacer") {
      lines.push("");
    } else if (entry.type === "pair") {
      lines.push(row(entry.left, entry.right, width));
    } else {
      const wrapped = wrap(entry.text, width);
      wrapped.forEach((line) => lines.push(entry.align === "center" ? center(line, width) : line));
    }
  }

  return lines.join("\r\n");
}

async function spoolReceiptText({ receipt, config, duplicate = false }) {
  const scriptPath = await resolvePrintScriptPath();
  logger.info("[RECEIPT_PRINT] print script resolved", { scriptPath });
  const jobDir = runtimePath("receipt-print-jobs");
  await fs.mkdir(jobDir, { recursive: true });
  const jobPath = path.join(jobDir, `receipt-${receipt.source_type}-${receipt.source_id}-${Date.now()}.json`);
  const job = {
    printerName: config.printerName,
    paperWidth: config.paperWidth,
    copies: config.copies,
    layout: buildThermalReceiptLayout(receipt, config, { duplicate }),
    text: buildThermalReceiptText(receipt, config, { duplicate }),
  };
  await writeJsonFile(jobPath, job);

  const powershellExe = process.env.SystemRoot
    ? path.join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
    : "powershell.exe";
  logger.info("[RECEIPT_PRINT] PowerShell started", {
    powershellExe,
    scriptPath,
    jobPath,
    printerName: config.printerName,
  });

  try {
    const { stdout, stderr } = await execFileAsync(
      powershellExe,
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-JobPath", jobPath, "-ConfigPath", getPrinterConfigPath()],
      {
        timeout: 30000,
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      }
    );
    const output = {
      jobPath,
      scriptPath,
      exitCode: 0,
      stdout: String(stdout || "").trim(),
      stderr: String(stderr || "").trim(),
    };
    logger.info("[RECEIPT_PRINT] PowerShell completed", output);
    return output;
  } catch (error) {
    logger.error("[RECEIPT_PRINT] PowerShell failed", {
      scriptPath,
      jobPath,
      exitCode: error.code ?? null,
      stdout: String(error.stdout || "").trim(),
      stderr: String(error.stderr || "").trim(),
      spawnError: error,
    });
    throw error;
  }
}

export async function printOrderReceipt(client, orderId, { source = "manual", force = false, duplicate = false } = {}) {
  const parsedOrderId = Number(orderId);
  if (!Number.isInteger(parsedOrderId) || parsedOrderId < 1) {
    const error = new Error("Invalid order ID");
    error.statusCode = 400;
    throw error;
  }

  const { configPath, config } = await getPrinterConfig();
  logger.info("[RECEIPT_PRINT] printer config loaded", {
    orderId: parsedOrderId,
    configPath,
    enabled: config.enabled,
    printerName: config.printerName,
    paperWidth: config.paperWidth,
    copies: config.copies,
    autoPrintKioskOrders: config.autoPrintKioskOrders,
  });
  if (!config.enabled || !config.printerName) {
    return {
      printed: false,
      skipped: true,
      reason: config.enabled ? "printer_not_configured" : "printing_disabled",
      configPath,
    };
  }

  if (source === "kiosk" && !config.autoPrintKioskOrders) {
    return { printed: false, skipped: true, reason: "kiosk_auto_print_disabled", configPath };
  }

  const key = printedRecordKey(parsedOrderId);
  if (!force) {
    const previous = await getPrintedRecord(parsedOrderId);
    if (previous?.result === "printed" && previous.printedAt) {
      return {
        printed: false,
        skipped: true,
        duplicate: true,
        reason: "already_printed",
        printedAt: previous.printedAt,
        printerName: previous.printerName,
      };
    }

    if (printLocks.has(key)) {
      return { printed: false, skipped: true, duplicate: true, reason: "print_in_progress" };
    }
  }

  printLocks.add(key);
  await markPrintAttempt(parsedOrderId, {
    result: "attempting",
    source,
    printerName: config.printerName,
    attemptedAt: new Date().toISOString(),
  });

  try {
    const receipt = await getOrderReceipt(client, parsedOrderId);
    logger.info("[RECEIPT_PRINT] order found", {
      orderId: parsedOrderId,
      orderNumber: receipt.order_number,
      sourceType: receipt.source_type,
    });
    const result = await spoolReceiptText({ receipt, config, duplicate });
    await markPrintAttempt(parsedOrderId, {
      result: "printed",
      source,
      printerName: config.printerName,
      paperWidth: config.paperWidth,
      copies: config.copies,
      printedAt: new Date().toISOString(),
      jobPath: result.jobPath,
    });
    logger.info("[RECEIPT_PRINT] success recorded", {
      orderId: parsedOrderId,
      source,
      printerName: config.printerName,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
    });
    return { printed: true, skipped: false, printerName: config.printerName, paperWidth: config.paperWidth, copies: config.copies };
  } catch (error) {
    await markPrintAttempt(parsedOrderId, {
      result: "failed",
      source,
      printerName: config.printerName,
      failedAt: new Date().toISOString(),
      error: error.message,
    });
    logger.error("Thermal receipt print failed", { orderId: parsedOrderId, source, error });
    return { printed: false, skipped: false, failed: true, message: error.message, printerName: config.printerName };
  } finally {
    printLocks.delete(key);
  }
}

export async function getPrinterStatus() {
  const { configPath, config } = await getPrinterConfig();
  const script = await resolvePrintScriptPath()
    .then((scriptPath) => ({ available: true, scriptPath }))
    .catch((error) => ({ available: false, error: error.message }));

  return {
    configPath,
    enabled: config.enabled,
    printerName: config.printerName,
    paperWidth: config.paperWidth,
    copies: config.copies,
    autoPrintKioskOrders: config.autoPrintKioskOrders,
    script,
  };
}

export async function getSampleReceiptText(client, configOverride = {}) {
  const { config } = await getPrinterConfig();
  const receipt = await getTestReceipt(client);
  return buildThermalReceiptText(receipt, { ...config, ...configOverride });
}
