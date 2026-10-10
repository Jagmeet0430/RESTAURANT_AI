import "../src/config/index.js";
import fs from "node:fs/promises";
import { pool } from "../src/config/database.js";

// Explicit operator command: never run migrations against a live DB on import.
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(hashtext('restaurantai_migration_016'))");
  await client.query(await fs.readFile(new URL("../database/migrations/016_cloud_order_sync.sql", import.meta.url), "utf8"));
  await client.query("COMMIT");
  console.log("Cloud order sync migration 016 applied successfully.");
} catch (error) {
  await client.query("ROLLBACK");
  console.error("Cloud order sync migration failed", { code: error.code || "MIGRATION_FAILED" });
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
