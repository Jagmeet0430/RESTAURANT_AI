import crypto from "crypto";
import { pool } from "../config/database.js";

const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ORDER_TOKEN_START = 101;

function randomTokenBody(length = 8) {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (byte) => TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length]).join("");
}

export function normalizeQrToken(value = "") {
  return String(value).trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 40);
}

export function normalizeOrderSource(value = "", fallback = "customer_web") {
  const normalized = String(value || fallback).trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
  if (["customer_web", "kiosk", "table_qr", "pos"].includes(normalized)) return normalized;
  return fallback;
}

export async function ensureTableQrSchema(client = pool) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS restaurant_tables (
      id SERIAL PRIMARY KEY,
      table_number VARCHAR(20) UNIQUE NOT NULL,
      display_name VARCHAR(80),
      qr_token VARCHAR(40),
      is_active BOOLEAN DEFAULT true,
      capacity INT DEFAULT 4,
      status VARCHAR(50) DEFAULT 'available',
      location VARCHAR(100),
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    ALTER TABLE restaurant_tables
      ADD COLUMN IF NOT EXISTS display_name VARCHAR(80),
      ADD COLUMN IF NOT EXISTS qr_token VARCHAR(40),
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS capacity INT DEFAULT 4,
      ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'available',
      ADD COLUMN IF NOT EXISTS location VARCHAR(100),
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  `);

  await client.query(`
    UPDATE restaurant_tables
    SET display_name = 'Table ' || table_number
    WHERE display_name IS NULL OR TRIM(display_name) = ''
  `);

  await client.query(`
    UPDATE restaurant_tables
    SET is_active = CASE
      WHEN LOWER(COALESCE(status, 'available')) IN ('inactive', 'disabled') THEN false
      ELSE true
    END
    WHERE is_active IS NULL
  `);

  const missingTokens = await client.query(`
    SELECT id
    FROM restaurant_tables
    WHERE qr_token IS NULL OR TRIM(qr_token) = ''
  `);
  for (const row of missingTokens.rows) {
    await client.query("UPDATE restaurant_tables SET qr_token = $1 WHERE id = $2", [
      await generateUniqueTableToken(client),
      row.id,
    ]);
  }

  await client.query(`
    ALTER TABLE restaurant_tables
      ALTER COLUMN display_name SET NOT NULL,
      ALTER COLUMN qr_token SET NOT NULL,
      ALTER COLUMN is_active SET NOT NULL
  `);
  await client.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurant_tables_table_number_unique ON restaurant_tables(table_number)");
  await client.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurant_tables_qr_token_unique ON restaurant_tables(qr_token)");
  await client.query("CREATE INDEX IF NOT EXISTS idx_restaurant_tables_is_active ON restaurant_tables(is_active)");

  await client.query(`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS table_id INT,
      ADD COLUMN IF NOT EXISTS table_number VARCHAR(20),
      ADD COLUMN IF NOT EXISTS order_source VARCHAR(30) DEFAULT 'customer_web',
      ADD COLUMN IF NOT EXISTS token_number INT,
      ADD COLUMN IF NOT EXISTS token_date DATE
  `);
  await client.query(`
    UPDATE orders
    SET order_source = 'customer_web'
    WHERE order_source IS NULL OR TRIM(order_source) = ''
  `);
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'orders_table_id_fkey'
      ) THEN
        ALTER TABLE orders
          ADD CONSTRAINT orders_table_id_fkey
          FOREIGN KEY (table_id)
          REFERENCES restaurant_tables(id)
          ON DELETE SET NULL;
      END IF;
    END $$
  `);
  await client.query("CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id)");
  await client.query("CREATE INDEX IF NOT EXISTS idx_orders_table_number ON orders(table_number)");
  await client.query("CREATE INDEX IF NOT EXISTS idx_orders_order_source ON orders(order_source)");
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_token_daily_unique
    ON orders(token_date, token_number)
    WHERE token_date IS NOT NULL AND token_number IS NOT NULL
  `);
}

export async function generateUniqueTableToken(client = pool) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const token = `TBL-${randomTokenBody(8)}`;
    const existing = await client.query("SELECT id FROM restaurant_tables WHERE qr_token = $1 LIMIT 1", [token]);
    if (existing.rowCount === 0) return token;
  }
  throw new Error("Unable to generate a unique table QR token");
}

export async function resolveTableByToken(client = pool, token, { requireActive = true } = {}) {
  const cleanToken = normalizeQrToken(token);
  if (!cleanToken) return null;

  await ensureTableQrSchema(client);
  const result = await client.query(
    `SELECT id, table_number, display_name, qr_token, is_active, capacity
     FROM restaurant_tables
     WHERE qr_token = $1
     LIMIT 1`,
    [cleanToken]
  );
  const table = result.rows[0];
  if (!table || (requireActive && !table.is_active)) {
    const error = new Error("This table QR is no longer active. Please ask restaurant staff.");
    error.statusCode = 404;
    throw error;
  }
  return table;
}

export async function resolveTableForOrder(client = pool, tableToken) {
  if (!tableToken) return null;
  return resolveTableByToken(client, tableToken, { requireActive: true });
}

export function appendOrderContextInstructions(instructions, { orderSource, table } = {}) {
  const lines = String(instructions || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const hasSource = lines.some((line) => /^source:/i.test(line));
  const hasTable = lines.some((line) => /^table:/i.test(line));

  if (orderSource && !hasSource) lines.push(`Source: ${orderSource}`);
  if (table && !hasTable) lines.push(`Table: ${table.table_number}`);
  return lines.join("\n") || null;
}

export async function generateDailyTokenNumber(client = pool) {
  await ensureTableQrSchema(client);
  await client.query("SELECT pg_advisory_xact_lock(hashtext('restaurantai_daily_order_tokens'))");
  const result = await client.query(
    `SELECT CURRENT_DATE AS token_date,
            GREATEST($1, COALESCE(MAX(token_number), $1 - 1) + 1)::int AS token_number
     FROM orders
     WHERE token_date = CURRENT_DATE`,
    [ORDER_TOKEN_START]
  );
  return result.rows[0];
}
