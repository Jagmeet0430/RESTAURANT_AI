import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import pg from "pg";
import dotenv from "dotenv";
import { cloudSyncConfig } from "../src/config/cloudSyncConfig.js";

const migrations = ["013_counter_sale_idempotency.sql", "014_table_qr_ordering.sql",
  "015_billing_receipts_settlement.sql", "016_cloud_order_sync.sql", "017_admin_order_notifications.sql", "018_menu_sync.sql"];

export function validateLocalConfig(env) {
  if (env.RESTAURANTAI_MODE !== "local") throw new Error("Deployment requires RESTAURANTAI_MODE=local");
  if (!["127.0.0.1", "localhost", "::1"].includes(env.DB_HOST)) throw new Error("Deployment requires PostgreSQL on this PC (loopback DB_HOST)");
  for (const key of ["DB_NAME", "DB_USER", "DB_PASSWORD", "JWT_SECRET", "OTP_SECRET"]) {
    if (!env[key]) throw new Error(`Missing required configuration: ${key}`);
  }
  cloudSyncConfig(env); // Validate only; never start a worker during setup or tests.
}

export async function prepareDatabase(env, { migrate = false, backup, menuOnly = false } = {}) {
  validateLocalConfig(env);
  const pool = new pg.Pool({ host: env.DB_HOST, port: Number(env.DB_PORT || 5432),
    database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD, ssl: false,
    connectionTimeoutMillis: 3000, max: 1 });
  let client;
  try {
    client = await pool.connect();
    const info = (await client.query("SELECT current_database() AS name, current_setting('server_version_num')::int AS version")).rows[0];
    if (info.name !== env.DB_NAME || info.version < 180000) throw new Error("Target database/version check failed; this Windows release requires PostgreSQL 18+");
    for (const table of ["schema_migrations", "orders", "customers", "counter_sales", "bills", "payments"]) {
      if (!(await client.query("SELECT to_regclass($1) AS name", [`public.${table}`])).rows[0].name) {
        throw new Error(`Missing baseline table: ${table}; do not run historical migrations blindly`);
      }
    }
    if (!migrate) return;
    if (menuOnly) {
      // Legacy development installations can have older schema without ledger entries.
      // Repair only the independent catalog migration; never invent their history.
      const prerequisite = await client.query("SELECT 1 FROM schema_migrations WHERE migration_name='windows-017_admin_order_notifications.sql'");
      if (!prerequisite.rowCount) throw new Error('Menu-only repair requires recorded migration 017; inspect migration history first');
      for (const table of ['menu','categories','admin_order_notifications']) {
        if (!(await client.query('SELECT to_regclass($1) AS name',[`public.${table}`])).rows[0].name) throw new Error(`Missing menu repair prerequisite: ${table}`);
      }
    }
    if (typeof backup !== "function") throw new Error("Verified backup is mandatory before migrations");
    // One installer at a time, including the backup step. No existing records are deleted.
    await client.query("SELECT pg_advisory_lock(hashtext('restaurantai_windows_deployment'))");
    const saved = await backup();
    if (!saved?.backupPath || !saved?.checksum) throw new Error("Backup did not return verified metadata");
    const bytes = await fs.readFile(saved.backupPath);
    if (!bytes.length || crypto.createHash("sha256").update(bytes).digest("hex") !== saved.checksum) throw new Error("Backup checksum validation failed");
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query("SET LOCAL statement_timeout = '120s'");
    for (const file of menuOnly ? ['018_menu_sync.sql'] : migrations) {
      const name = `windows-${file}`;
      const sql = await fs.readFile(new URL(`../database/migrations/${file}`, import.meta.url), "utf8");
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');
      const exists = await client.query("SELECT checksum FROM schema_migrations WHERE migration_name=$1", [name]);
      if (exists.rowCount) {
        if (exists.rows[0].checksum && exists.rows[0].checksum !== checksum) {
          throw Object.assign(new Error(`Applied migration checksum mismatch: ${name}`), { code: 'MIGRATION_CHECKSUM_MISMATCH' });
        }
        continue;
      }
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations(migration_name, checksum, baseline) VALUES ($1, $2, false)", [name,checksum]);
    }
    await client.query("COMMIT");
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    if (client) {
      await client.query("SELECT pg_advisory_unlock_all()").catch(() => {});
      client.release();
    }
    await pool.end();
  }
}

async function main() {
  const [command, configFile] = process.argv.slice(2);
  if (!["check", "wait", "migrate", "migrate-menu"].includes(command) || !configFile || !path.isAbsolute(configFile)) {
    throw new Error("Usage: node scripts/deployment.js check|wait|migrate|migrate-menu <absolute-config-path>");
  }
  const env = dotenv.parse(await fs.readFile(configFile));
  validateLocalConfig(env);
  if (command === "wait") {
    const deadline = Date.now() + 60000;
    while (true) {
      try { await prepareDatabase(env); break; }
      catch (error) {
        if (Date.now() >= deadline || !["ECONNREFUSED", "57P03", "ETIMEDOUT"].includes(error.code)) throw error;
        console.log("Waiting for local PostgreSQL...");
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  } else {
    let backup;
    const migrate = command === 'migrate' || command === 'migrate-menu';
    if (migrate) {
      Object.assign(process.env, env, {
        RESTAURANTAI_ENV_FILE: configFile, RESTAURANTAI_ENV_PATH: configFile,
        BACKUP_DIR: path.resolve(path.dirname(configFile), "../backups/migrations", crypto.randomUUID()),
      });
      ({ runBackup: backup } = await import("./backupDatabase.js"));
    }
    await prepareDatabase(env, { migrate, backup, menuOnly: command === 'migrate-menu' });
  }
  console.log(`Deployment ${command} passed.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    // Database exceptions can contain SQL and connection details; report safe codes only.
    console.error("Deployment check failed.", { code: /^[A-Z0-9_]{1,60}$/.test(error.code || "") ? error.code : "DEPLOYMENT_VALIDATION_FAILED" });
    process.exitCode = 1;
  });
}
