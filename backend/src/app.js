import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ======================================================
// Load environment variables before application imports
// ======================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath =
  process.env.RESTAURANTAI_ENV_FILE ||
  process.env.RESTAURANTAI_ENV_PATH ||
  path.resolve(__dirname, "../.env");

dotenv.config({
  path: envPath,
});

// ======================================================
// Application imports
// ======================================================

import express from "express";
import cors from "cors";

import { pool } from "./config/database.js";
import { appConfig, corsConfig } from "./config/index.js";
import { createCorsOptions } from "./config/corsPolicy.js";
import { getDiagnostics, getReadiness } from "./services/diagnosticsService.js";
import { logger, requestMeta } from "./utils/logger.js";
import { authMiddleware, authorizeRoles } from "./middleware/index.js";

// Routes
import authRoutes from "./routes/authRoutes.js";
import whatsappAuthRoutes from "./routes/whatsappAuthRoutes.js";
import menuRoutes from "./routes/menuRoutes.js";
import categoriesRoutes from "./routes/categoriesRoutes.js";
import ordersRoutes from "./routes/orderRoutes.js";
import customersRoutes from "./routes/customersRoutes.js";
import kitchenRoutes from "./routes/kitchenRoutes.js";
import couponsRoutes from "./routes/couponsRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import predictionRoutes from "./routes/predictionRoutes.js";
import reportsRoutes from "./routes/reportsRoutes.js";
import recommendationsRoutes from "./routes/recommendationsRoutes.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";
import productsRoutes from "./routes/productsRoutes.js";
import supplierRoutes from "./routes/supplierRoutes.js";
import chatbotRoutes from "./routes/chatbotRoutes.js";
import aiAssistantRoutes from "./routes/aiAssistantRoutes.js";
import ocrRoutes from "./routes/ocrRoutes.js";
import notificationsRoutes from "./routes/notificationsRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import tablesRoutes from "./routes/tablesRoutes.js";
import billsRoutes from "./routes/billsRoutes.js";
import barcodeRoutes from "./routes/barcodeRoutes.js";
import counterSaleRoutes from "./routes/counterSaleRoutes.js";
import adminOrderRoutes from "./routes/adminOrderRoutes.js";
import whatsappWebhookRoutes from "./routes/whatsappWebhookRoutes.js";
import receiptPrinterRoutes from "./routes/receiptPrinterRoutes.js";
import { handleWebhook } from "./controllers/paymentController.js";

const app = express();

// ======================================================
// CORS configuration
// ======================================================

const corsOptions = createCorsOptions({
  appConfig,
  corsConfig,
  frontendUrl: process.env.FRONTEND_URL,
  adminUrl: process.env.ADMIN_URL,
  onRejected: (origin) => logger.warn("Blocked CORS origin", { origin }),
});

// CORS must be before routes
app.use(cors(corsOptions));

// Explicitly handle browser preflight requests
app.options(/.*/, cors(corsOptions));

app.use(express.json({ limit: "6mb" }));
app.use(express.urlencoded({ extended: true, limit: "6mb" }));

// ======================================================
// Database access
// ======================================================

app.locals.pool = pool;

// ======================================================
// API routes
// ======================================================

app.post(
  "/api/payments/webhook",
  express.raw({
    type: "application/json",
    limit: "1mb",
  }),
  handleWebhook
);

app.use("/api/auth", authRoutes);
app.use("/api/auth/whatsapp", whatsappAuthRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/customers", customersRoutes);
app.use("/api/kitchen", kitchenRoutes);
app.use("/api/coupons", couponsRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/predictions", predictionRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/recommendations", recommendationsRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/ai-assistant", aiAssistantRoutes);
app.use("/api/ocr", ocrRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/tables", tablesRoutes);
app.use("/api/bills", billsRoutes);
app.use("/api/barcodes", barcodeRoutes);
app.use("/api/counter-sales", counterSaleRoutes);
app.use("/api/admin/orders", adminOrderRoutes);
app.use("/api/webhooks/whatsapp", whatsappWebhookRoutes);
app.use("/api/receipt-printer", receiptPrinterRoutes);

/*
 * Keep these aliases only if your frontend is already calling them.
 * Ideally, use only /api/ai-assistant throughout the project.
 */
app.use("/api/chat", aiAssistantRoutes);
app.use("/chat", aiAssistantRoutes);

// ======================================================
// Customer frontend
// ======================================================

const frontendPath = path.resolve(__dirname, "../../frontend");
const adminDistPath = path.resolve(__dirname, "../../admin/dist");
const hasHiddenPathSegment = (requestPath) =>
  requestPath
    .split("/")
    .filter(Boolean)
    .some((segment) => segment.startsWith("."));
const routeNotFound = (res) =>
  res.status(404).json({ success: false, message: "Route Not Found" });

if (fs.existsSync(path.join(adminDistPath, "index.html"))) {
  app.use("/admin", (req, res, next) => {
    if (hasHiddenPathSegment(req.path)) {
      return routeNotFound(res);
    }

    return next();
  });

  app.use("/admin", express.static(adminDistPath, {
    dotfiles: "deny",
    index: false,
  }));

  app.get(["/admin", "/admin/*"], (req, res) => {
    if (req.path.startsWith("/admin/assets/")) {
      return routeNotFound(res);
    }

    res.sendFile(path.join(adminDistPath, "index.html"));
  });
}

app.use("/customer", (req, res, next) => {
  if (hasHiddenPathSegment(req.path)) {
    return routeNotFound(res);
  }

  return next();
});

app.use("/customer", express.static(frontendPath, {
  dotfiles: "deny",
  index: false,
}));

app.get(["/customer", "/customer/*"], (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// ======================================================
// Health check
// ======================================================

app.get("/api/health", async (req, res) => {
  let database = "disconnected";

  try {
    await pool.query("SELECT 1");
    database = "connected";
  } catch (error) {
    logger.warn("Health database check failed", { error });
  }

  res.status(200).json({
    success: true,
    status: "ok",
    mode: appConfig.mode,
    database,
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/ready", async (req, res) => {
  const readiness = await getReadiness();
  return res.status(readiness.ready ? 200 : 503).json({
    success: readiness.ready,
    status: readiness.ready ? "ready" : "not_ready",
    checks: readiness.checks,
    timestamp: readiness.timestamp,
  });
});

app.get(
  "/api/diagnostics",
  authMiddleware,
  authorizeRoles(["admin"]),
  async (req, res, next) => {
    try {
      return res.status(200).json(await getDiagnostics());
    } catch (error) {
      return next(error);
    }
  }
);

// Root route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "RestaurantAI Backend API",
    healthCheck: "/api/health",
  });
});

// ======================================================
// Route not found
// ======================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route Not Found",
    method: req.method,
    path: req.originalUrl,
  });
});

// ======================================================
// Global error handler
// ======================================================

app.use((err, req, res, next) => {
  logger.error("Backend request error", { error: err, request: requestMeta(req) });

  if (
    err.message?.includes("Origin not allowed by CORS") ||
    err.message?.includes("CORS blocked origin")
  ) {
    return res.status(403).json({
      success: false,
      message: err.message,
    });
  }

  return res.status(err.status || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message || "Internal server error",
  });
});

export default app;
