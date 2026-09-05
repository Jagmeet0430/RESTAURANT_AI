import pg from "pg";
import {
  appConfig,
  dbConfig,
  isLocalMode,
} from "./index.js";
import { logger } from "../utils/logger.js";

const { Pool } = pg;

const buildLocalDatabaseConfig = () => ({
  host: dbConfig.host,
  port: Number(dbConfig.port),
  database: dbConfig.database,
  user: dbConfig.user,
  password: dbConfig.password,
  ssl: false,
});

const buildOnlineDatabaseConfig = () => {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl:
        appConfig.nodeEnv === "production"
          ? { rejectUnauthorized: false }
          : false,
    };
  }

  return {
    host: dbConfig.host,
    port: Number(dbConfig.port),
    database: dbConfig.database,
    user: dbConfig.user,
    password: dbConfig.password,
    ssl: false,
  };
};

const poolConfig = isLocalMode
  ? buildLocalDatabaseConfig()
  : buildOnlineDatabaseConfig();

export const pool = new Pool({
  ...poolConfig,

  max: isLocalMode ? 20 : appConfig.nodeEnv === "production" ? 5 : 20,

  idleTimeoutMillis:
    appConfig.nodeEnv === "production" && !isLocalMode
      ? 10000
      : 30000,

  connectionTimeoutMillis: isLocalMode ? 5000 : 10000,
});

pool.on("error", (error) => {
  logger.error("Unexpected PostgreSQL pool error", { error });
});

export const testConnection = async () => {
  logger.info("Testing PostgreSQL connection", {
    mode: appConfig.mode,
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.user,
  });

  if (isLocalMode) {
    logger.info("Database type resolved", { type: "local-postgresql" });
  } else {
    logger.info("Database type resolved", {
      type: "online-postgresql",
      databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
    });
  }

  try {
    const client = await pool.connect();

    try {
      const result = await client.query(`
        SELECT
          NOW() AS current_time,
          current_database() AS database_name,
          current_user AS database_user
      `);

      const info = result.rows[0];

      logger.info("PostgreSQL connection successful", {
        database: info.database_name,
        user: info.database_user,
        time: info.current_time,
      });

      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error("PostgreSQL connection failed", { error });

    if (isLocalMode) {
      logger.warn("Local PostgreSQL checks needed", {
        checks: [
          "PostgreSQL is running",
          `Database '${dbConfig.database}' exists`,
          "DB_USER and DB_PASSWORD are correct",
          `PostgreSQL is listening on port ${dbConfig.port}`,
        ],
      });
    }

    return false;
  }
};
