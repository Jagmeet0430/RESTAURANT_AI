import dotenv from "dotenv";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env BEFORE importing other files
const envPath =
  process.env.RESTAURANTAI_ENV_FILE ||
  process.env.RESTAURANTAI_ENV_PATH ||
  path.resolve(__dirname, "../.env");

dotenv.config({
  path: envPath,
});

import app from "./app.js";
import { appConfig } from "./config/index.js";
import { pool, testConnection } from "./config/database.js";
import { startOrderLifecycleWorker } from "./services/orderLifecycleService.js";
import { logger } from "./utils/logger.js";

const PORT = appConfig.port;
const HOST = appConfig.host;
const sockets = new Set();
let isShuttingDown = false;
let orderLifecycleWorker = null;

const isPrivateIpv4 = (address) =>
  address.startsWith("10.") ||
  address.startsWith("192.168.") ||
  /^172\.(1[6-9]|2\d|3[0-1])\./.test(address);

const getPrivateIpv4Addresses = () =>
  Object.values(os.networkInterfaces())
    .flat()
    .filter((network) => network && network.family === "IPv4" && !network.internal)
    .map((network) => network.address)
    .filter(isPrivateIpv4);

const isLanHost = HOST === "0.0.0.0" || HOST === "::";

logger.info("Loaded environment file", { path: envPath });

// Start server
const server = app.listen(PORT, HOST, async () => {
  logger.info("RestaurantAI backend listening", {
    mode: appConfig.mode,
    host: HOST,
    port: PORT,
    localUrl: `http://127.0.0.1:${PORT}`,
    lanAccess: isLanHost ? "enabled" : "disabled",
    environment: appConfig.nodeEnv,
  });

  if (isLanHost) {
    const lanAddresses = getPrivateIpv4Addresses();

    if (lanAddresses.length === 0) {
      logger.warn("LAN enabled but no private IPv4 address detected");
    } else {
      for (const address of lanAddresses) {
        logger.info("LAN URL available", {
          url: `http://${address}:${PORT}`,
          health: `http://${address}:${PORT}/api/health`,
          ready: `http://${address}:${PORT}/api/ready`,
        });
      }
    }
  }

  const connected = await testConnection();

  if (connected) {
    orderLifecycleWorker = startOrderLifecycleWorker();
    logger.info("RestaurantAI backend ready");
  } else {
    logger.warn("RestaurantAI backend is listening but not ready because database connection failed");
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    logger.fatal("Backend port already in use", { host: HOST, port: PORT, error });
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
  logger.info("Shutdown signal received", { signal });
  let finished = false;

  const finish = async () => {
    if (finished) {
      return;
    }

    finished = true;
    try {
      await pool.end();
      logger.info("PostgreSQL pool closed");
    } catch (error) {
      logger.error("PostgreSQL pool close failed", { error });
    } finally {
      onClosed();
    }
  };

  const forceCloseTimeout = setTimeout(() => {
    logger.warn("Forcing HTTP server shutdown");

    for (const socket of sockets) {
      socket.destroy();
    }

    if (typeof server.closeAllConnections === "function") {
      server.closeAllConnections();
    }

    finish();
  }, 1000);

  server.close(() => {
    clearTimeout(forceCloseTimeout);
    logger.info("HTTP server closed");
    finish();
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

process.on("uncaughtException", (error) => {
  logger.fatal("Uncaught exception", { error });
  closeServer("uncaughtException", () => process.exit(1));
});

process.on("unhandledRejection", (reason) => {
  logger.fatal("Unhandled promise rejection", { error: reason });
  closeServer("unhandledRejection", () => process.exit(1));
});
