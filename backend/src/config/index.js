import dotenv from "dotenv";
import path from "path";

dotenv.config(
  process.env.RESTAURANTAI_ENV_FILE || process.env.RESTAURANTAI_ENV_PATH
    ? { path: process.env.RESTAURANTAI_ENV_FILE || process.env.RESTAURANTAI_ENV_PATH }
    : undefined
);

const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
};

const parseList = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeMode = (value) => {
  const mode = String(value || "online")
    .trim()
    .toLowerCase();

  if (!["online", "local"].includes(mode)) {
    throw new Error(
      `Invalid RESTAURANTAI_MODE "${value}". Use "online" or "local".`
    );
  }

  return mode;
};

export const appConfig = {
  mode: normalizeMode(process.env.RESTAURANTAI_MODE),
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  host: process.env.HOST || "127.0.0.1",
};

const stateRoot = process.env.RESTAURANTAI_STATE_ROOT
  ? path.resolve(process.env.RESTAURANTAI_STATE_ROOT)
  : "";

const defaultUploadDir = stateRoot
  ? path.join(stateRoot, "data", "uploads")
  : "uploads";

export const isLocalMode = appConfig.mode === "local";
export const isOnlineMode = appConfig.mode === "online";

export const corsConfig = {
  origins: [
    ...parseList(process.env.CORS_ORIGINS),
    ...parseList(process.env.CORS_ORIGIN),
  ],
  allowLanOrigins: parseBoolean(process.env.ALLOW_LAN_ORIGINS, false),
  lanClientPorts: parseList(
    process.env.LAN_CLIENT_PORTS || "3000,5173,5174,5175,5500,5501,8080"
  ),
};

export const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "restaurantai",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "",
};

export const jwtConfig = {
  secret: process.env.JWT_SECRET,
  expire: process.env.JWT_EXPIRE || "7d",
};

export const fileConfig = {
  maxSize: Number(process.env.MAX_FILE_SIZE || 5242880),

  allowedExtensions: (
    process.env.ALLOWED_EXTENSIONS || "jpg,jpeg,png,gif,webp"
  )
    .split(",")
    .map((extension) => extension.trim())
    .filter(Boolean),

  uploadDir: process.env.UPLOAD_DIR || defaultUploadDir,
};

export const backupConfig = {
  dir: process.env.BACKUP_DIR || "../backups/database",
  postgresBinDir: process.env.POSTGRES_BIN_DIR || "",
  retentionDays: Number(process.env.BACKUP_RETENTION_DAYS || 30),
  retentionCount: Number(process.env.BACKUP_RETENTION_COUNT || 30),
};
