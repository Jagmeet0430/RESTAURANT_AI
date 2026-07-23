import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env BEFORE importing other files
dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

console.log("Loaded .env from:", path.resolve(__dirname, "../.env"));

import app from "./app.js";
import { testConnection } from "./config/database.js";
import { startOrderLifecycleWorker } from "./services/orderLifecycleService.js";

const PORT = process.env.PORT || 5000;
const sockets = new Set();
let isShuttingDown = false;
let orderLifecycleWorker = null;

// Start server
const server = app.listen(PORT, async () => {
  console.log(`
╔════════════════════════════════════════╗
║   🍽️  RestaurantAI Backend Server     ║
║                                        ║
║  Server: http://localhost:${PORT}      ║
║  Environment: ${process.env.NODE_ENV || "development"}      ║
║  Status: ✅ Running                    ║
╚════════════════════════════════════════╝
`);

  console.log("DB_HOST:", process.env.DB_HOST);
  console.log("DB_PORT:", process.env.DB_PORT);
  console.log("DB_NAME:", process.env.DB_NAME);
  console.log("DB_USER:", process.env.DB_USER);
  console.log("DB_PASSWORD:", process.env.DB_PASSWORD ? "[set]" : "[missing]");

  console.log("\n📡 Testing Database Connection...");

  const connected = await testConnection();

  if (connected) {
    orderLifecycleWorker = startOrderLifecycleWorker();
  }

  if (connected) {
    console.log("✅ All systems operational!\n");
  } else {
    console.log("⚠️ Warning: Database connection failed. Some features may not work.\n");
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use. Stop the existing backend process, then restart npm run dev.`
    );
    process.exit(1);
  }

  throw error;
});

const closeServer = (signal, onClosed = () => process.exit(0)) => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  if (orderLifecycleWorker) {
    clearInterval(orderLifecycleWorker);
  }
  console.log(`${signal} signal received: closing HTTP server`);

  const forceCloseTimeout = setTimeout(() => {
    console.log("Forcing HTTP server shutdown");

    for (const socket of sockets) {
      socket.destroy();
    }

    if (typeof server.closeAllConnections === "function") {
      server.closeAllConnections();
    }

    onClosed();
  }, 1000);

  server.close(() => {
    clearTimeout(forceCloseTimeout);
    console.log("HTTP server closed");
    onClosed();
  });

  if (typeof server.closeIdleConnections === "function") {
    server.closeIdleConnections();
  }
};

server.on("connection", (socket) => {
  sockets.add(socket);

  socket.on("close", () => {
    sockets.delete(socket);
  });
});

process.once("SIGTERM", () => closeServer("SIGTERM"));
process.once("SIGINT", () => closeServer("SIGINT"));

// Nodemon uses SIGUSR2 for restarts. Close the port before nodemon starts again.
process.once("SIGUSR2", () => {
  closeServer("SIGUSR2", () => {
    process.kill(process.pid, "SIGUSR2");
  });
});
