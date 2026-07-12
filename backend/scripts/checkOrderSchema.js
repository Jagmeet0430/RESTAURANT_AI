import { pool } from "../src/config/database.js";

const tables = await pool.query(`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('customers', 'orders', 'order_items')
  ORDER BY table_name;
`);

console.table(tables.rows);

const columns = await pool.query(`
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN ('customers', 'orders', 'order_items')
  ORDER BY table_name, ordinal_position;
`);

console.table(columns.rows);

await pool.end();
