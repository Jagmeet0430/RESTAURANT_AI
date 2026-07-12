import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// ======================================================
// Load environment variables before application imports
// ======================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, "../.env");

dotenv.config({
  path: envPath,
});

// ======================================================
// Application imports
// ======================================================

import express from "express";
import cors from "cors";

import { pool } from "./config/database.js";
import { errorHandler } from "./middleware/index.js";

// Routes
import authRoutes from "./routes/authRoutes.js";
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
import chatbotRoutes from "./routes/chatbotRoutes.js";
import aiAssistantRoutes from "./routes/aiAssistantRoutes.js";
import ocrRoutes from "./routes/ocrRoutes.js";

const app = express();

// ======================================================
// CORS configuration
// ======================================================

const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",

  "http://localhost:5174",
  "http://127.0.0.1:5174",

  "http://localhost:3000",
  "http://127.0.0.1:3000",

  "http://localhost:5500",
  "http://127.0.0.1:5500",
];

const environmentOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  : [];

const allowedOrigins = [
  ...new Set([...defaultAllowedOrigins, ...environmentOrigins]),
];

const corsOptions = {
  origin(origin, callback) {
    /*
     * No Origin header:
     * Allows Postman, curl, Swagger, mobile clients and server-to-server calls.
     */
    if (!origin) {
      return callback(null, true);
    }

    /*
     * The literal string "null" commonly occurs when an HTML page is opened
     * directly through file:// instead of through the Vite development server.
     *
     * Allow it only during local development.
     */
    if (origin === "null" && process.env.NODE_ENV !== "production") {
      console.warn(
        "CORS warning: allowing origin 'null' in development. Open the frontend through Vite instead of file://."
      );

      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.error(`CORS blocked for origin: ${origin}`);

    const corsError = new Error(`CORS blocked for origin: ${origin}`);
    corsError.statusCode = 403;

    return callback(corsError);
  },

  credentials: true,

  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Accept",
    "Origin",
    "X-Requested-With",
  ],

  exposedHeaders: ["Content-Length"],

  optionsSuccessStatus: 204,
};

// CORS must be registered before routes
app.use(cors(corsOptions));

// Handle browser preflight requests
app.options("*", cors(corsOptions));

// ======================================================
// Request middleware
// ======================================================

app.use(
  express.json({
    limit: "10mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);

// ======================================================
// Database access
// ======================================================

app.locals.pool = pool;

// ======================================================
// API routes
// ======================================================

app.use("/api/auth", authRoutes);
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
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/ai-assistant", aiAssistantRoutes);
app.use("/api/ocr", ocrRoutes);

/*
 * Keep these aliases only if your frontend is already calling them.
 * Ideally, use only /api/ai-assistant throughout the project.
 */
app.use("/api/chat", aiAssistantRoutes);
app.use("/chat", aiAssistantRoutes);

// ======================================================
// Health check
// ======================================================

app.get("/api/health", async (req, res, next) => {
  try {
    const databaseResult = await pool.query(
      "SELECT NOW() AS database_time"
    );

    res.status(200).json({
      success: true,
      status: "OK",
      message: "RestaurantAI Backend Running",
      database: {
        connected: true,
        name: process.env.DB_NAME || null,
        time: databaseResult.rows[0].database_time,
      },
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

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

app.use(errorHandler);

export default app;
