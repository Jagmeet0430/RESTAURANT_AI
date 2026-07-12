import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import { pool } from "../src/config/database.js";

const migrationPath = process.argv[2];

if (!migrationPath) {
  console.error("Usage: node scripts/runMigration.js <sql-file>");
  process.exit(1);
}

const resolvedPath = path.resolve(migrationPath);
const sql = readFileSync(resolvedPath, "utf8");

try {
  await pool.query(sql);
  console.log(`Migration applied: ${resolvedPath}`);
} finally {
  await pool.end();
}
