import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path:
    process.env.RESTAURANTAI_ENV_FILE ||
    process.env.RESTAURANTAI_ENV_PATH ||
    path.resolve(__dirname, "../.env"),
});

const { pool } = await import("../src/config/database.js");

async function tableExists(tableName) {
  const result = await pool.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = $1
     ) AS exists`,
    [tableName]
  );
  return Boolean(result.rows[0]?.exists);
}

async function columnExists(tableName, columnName) {
  const result = await pool.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND column_name = $2
     ) AS exists`,
    [tableName, columnName]
  );
  return Boolean(result.rows[0]?.exists);
}

async function scalar(name, query, params = []) {
  const result = await pool.query(query, params);
  return {
    name,
    count: Number(result.rows[0]?.count || 0),
  };
}

async function safeCheck(name, prerequisites, query, params = []) {
  const ok = await prerequisites();
  if (!ok) {
    return {
      name,
      status: "skipped",
      count: null,
      detail: "Required table or column is not present",
    };
  }

  const result = await scalar(name, query, params);
  return {
    ...result,
    status: result.count === 0 ? "pass" : "fail",
  };
}

const checks = [
  await safeCheck(
    "orphan_order_items",
    async () => (await tableExists("order_items")) && (await tableExists("orders")),
    `SELECT COUNT(*)::int
     FROM order_items oi
     LEFT JOIN orders o ON o.id = oi.order_id
     WHERE o.id IS NULL`
  ),
  await safeCheck(
    "orphan_counter_sale_items",
    async () => (await tableExists("counter_sale_items")) && (await tableExists("counter_sales")),
    `SELECT COUNT(*)::int
     FROM counter_sale_items csi
     LEFT JOIN counter_sales cs ON cs.id = csi.sale_id
     WHERE cs.id IS NULL`
  ),
  await safeCheck(
    "orphan_inventory_transactions_products",
    async () =>
      (await tableExists("inventory_transactions")) &&
      (await tableExists("products")) &&
      (await columnExists("inventory_transactions", "product_id")),
    `SELECT COUNT(*)::int
     FROM inventory_transactions it
     LEFT JOIN products p ON p.id = it.product_id
     WHERE it.product_id IS NOT NULL
       AND p.id IS NULL`
  ),
  await safeCheck(
    "negative_product_stock",
    async () => (await tableExists("products")) && (await columnExists("products", "quantity")),
    "SELECT COUNT(*)::int FROM products WHERE quantity < 0"
  ),
  await safeCheck(
    "duplicate_product_barcodes",
    async () => (await tableExists("products")) && (await columnExists("products", "barcode")),
    `SELECT COUNT(*)::int
     FROM (
       SELECT TRIM(barcode)
       FROM products
       WHERE barcode IS NOT NULL
         AND TRIM(barcode) <> ''
       GROUP BY TRIM(barcode)
       HAVING COUNT(*) > 1
     ) duplicates`
  ),
  await safeCheck(
    "invalid_order_statuses",
    async () => (await tableExists("orders")) && (await columnExists("orders", "status")),
    `SELECT COUNT(*)::int
     FROM orders
     WHERE status NOT IN (
       'Pending',
       'Confirmed',
       'Accepted',
       'Preparing',
       'Ready',
       'Out for Delivery',
       'Completed',
       'Delivered',
       'Cancelled',
       'pending_verification'
     )`
  ),
  await safeCheck(
    "missing_offline_baseline",
    async () => await tableExists("schema_migrations"),
    `SELECT CASE WHEN EXISTS (
       SELECT 1
       FROM schema_migrations
       WHERE migration_name = 'offline-v1-baseline'
     ) THEN 0 ELSE 1 END::int AS count`
  ),
];

const failed = checks.filter((check) => check.status === "fail");
const result = {
  success: failed.length === 0,
  checkedAt: new Date().toISOString(),
  database: process.env.DB_NAME || "restaurantai",
  checks,
};

console.log(JSON.stringify(result, null, 2));
await pool.end();
process.exit(failed.length === 0 ? 0 : 2);
