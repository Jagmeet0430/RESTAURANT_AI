// PostgreSQL Database Connection Pool
import pg from "pg";
import { dbConfig } from "./index.js";

const { Pool } = pg;

const isProduction = process.env.NODE_ENV === "production";

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: isProduction ? { rejectUnauthorized: false } : false,
    }
  : {
      user: dbConfig.user,
      password: dbConfig.password,
      host: dbConfig.host,
      port: Number(dbConfig.port),
      database: dbConfig.database,
    };

// Create a connection pool
export const pool = new Pool({
  ...poolConfig,
  max: isProduction ? 5 : 20,
  idleTimeoutMillis: isProduction ? 10000 : 30000,
  connectionTimeoutMillis: isProduction ? 10000 : 2000,
});

// Handle pool errors
pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
});

// Test connection
export const testConnection = async () => {
  console.log("========== DATABASE CONFIG ==========");
  console.log({
    ...(process.env.DATABASE_URL
      ? { connectionString: "[DATABASE_URL set]" }
      : {
          ...dbConfig,
          password: dbConfig.password ? "[set]" : "[missing]",
        }),
  });
  console.log("=====================================");

  try {
    const result = await pool.query("SELECT NOW()");
    console.log("✅ PostgreSQL Connection successful at:", result.rows[0].now);
    return true;
  } catch (error) {
    console.error("Full Error Object:");
    console.error(error);

    console.error("❌ PostgreSQL Connection failed:", error.message);
    return false;
  }
};
export default pool;
