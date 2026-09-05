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
import barcodeRoutes from "./routes/barcodeRoutes.js";
import counterSaleRoutes from "./routes/counterSaleRoutes.js";
import adminOrderRoutes from "./routes/adminOrderRoutes.js";
import whatsappWebhookRoutes from "./routes/whatsappWebhookRoutes.js";
import { handleWebhook } from "./controllers/paymentController.js";

const app = express();

// ======================================================
// CORS configuration
// ======================================================

const defaultAllowedOrigins = [
  "https://mahesh-bakery-menu.dwivedibharat969.chatgpt.site",
  "http://localhost:5500",
  "http://localhost:5501",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5500",
  "http://127.0.0.1:5501",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
];

const allowedOrigins = [
  ...new Set(
    [
      ...defaultAllowedOrigins,
      ...corsConfig.origins,
      process.env.FRONTEND_URL,
      process.env.ADMIN_URL,
    ].filter(Boolean)
  ),
];

const isDevelopment = process.env.NODE_ENV !== "production";

const isPrivateLanHostname = (hostname) =>
  hostname.startsWith("192.168.") ||
  hostname.startsWith("10.") ||
  /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);

const isExpectedClientOrigin = (origin, { allowPrivateLan = false } = {}) => {
  if (origin === "null") {
    return isDevelopment;
  }

  try {
    const { hostname, port, protocol } = new URL(origin);
    const isHttp = protocol === "http:" || protocol === "https:";
    const isExpectedPort = corsConfig.lanClientPorts.includes(port);
    const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";
    const isPrivateLan = isPrivateLanHostname(hostname);

    return isHttp && isExpectedPort && (isLocalHost || (allowPrivateLan && isPrivateLan));
  } catch {
    return false;
  }
};

const isAllowedLocalRuntimeOrigin = (origin) =>
  (isDevelopment || appConfig.mode === "local") &&
  isExpectedClientOrigin(origin, {
    allowPrivateLan: corsConfig.allowLanOrigins,
  });

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || isAllowedLocalRuntimeOrigin(origin)) {
      return callback(null, true);
    }

    logger.warn("Blocked CORS origin", { origin });
    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept", "Idempotency-Key"],
  credentials: true,
  optionsSuccessStatus: 204,
};

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
app.use("/api/barcodes", barcodeRoutes);
app.use("/api/counter-sales", counterSaleRoutes);
app.use("/api/admin/orders", adminOrderRoutes);
app.use("/api/webhooks/whatsapp", whatsappWebhookRoutes);

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

if (fs.existsSync(path.join(adminDistPath, "index.html"))) {
  app.use("/admin", express.static(adminDistPath, {
    dotfiles: "deny",
    index: false,
  }));

  app.get(["/admin", "/admin/*"], (req, res) => {
    if (hasHiddenPathSegment(req.path)) {
      return res.status(404).json({ success: false, message: "Route Not Found" });
    }

    res.sendFile(path.join(adminDistPath, "index.html"));
  });
}

app.use("/customer", express.static(frontendPath, {
  dotfiles: "deny",
  index: false,
}));

app.get(["/customer", "/customer/*"], (req, res) => {
  if (hasHiddenPathSegment(req.path)) {
    return res.status(404).json({ success: false, message: "Route Not Found" });
  }

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
