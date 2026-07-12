// PostgreSQL Database Connection Pool
import pg from "pg";
import { dbConfig } from "./index.js";

const { Pool } = pg;

// Create a connection pool
export const pool = new Pool({
  user: dbConfig.user,
  password: dbConfig.password,
  host: dbConfig.host,
  port: Number(dbConfig.port),
  database: dbConfig.database,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Handle pool errors
pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

// Test connection
export const testConnection = async () => {
  console.log("========== DATABASE CONFIG ==========");
  console.log({
    ...dbConfig,
    password: dbConfig.password ? "[set]" : "[missing]",
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
