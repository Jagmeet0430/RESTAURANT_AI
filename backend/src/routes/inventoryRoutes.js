import express from "express";
import { pool } from "../config/database.js";
import { successResponse, errorResponse, asyncHandler } from "../utils/index.js";

const router = express.Router();

// Ensure tables exist (ingredients, suppliers, inventory)
const ensureSchema = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      contact VARCHAR(255),
      email VARCHAR(255),
      phone VARCHAR(50),
      address TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS ingredients (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      unit VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS inventory_items (
      id SERIAL PRIMARY KEY,
      ingredient_id INT REFERENCES ingredients(id) ON DELETE CASCADE,
      supplier_id INT REFERENCES suppliers(id) ON DELETE SET NULL,
      stock_quantity INT DEFAULT 0,
      min_threshold INT DEFAULT 10,
      expiry_date DATE,
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

// GET /api/inventory - list inventory
router.get("/", asyncHandler(async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    const result = await client.query(`
      SELECT i.id, ing.name as ingredient, ing.unit, s.name as supplier, i.stock_quantity, i.min_threshold, i.expiry_date, i.last_updated
      FROM inventory_items i
      JOIN ingredients ing ON i.ingredient_id = ing.id
      LEFT JOIN suppliers s ON i.supplier_id = s.id
      ORDER BY ing.name
    `);
    return successResponse(res, result.rows);
  } catch (err) {
    return errorResponse(res, err.message);
  } finally {
    client.release();
  }
}));

// POST /api/inventory - add or update item
router.post("/", asyncHandler(async (req, res) => {
  const { ingredient, unit, supplier_id, stock_quantity = 0, min_threshold = 10, expiry_date } = req.body;
  if (!ingredient) return errorResponse(res, "ingredient is required", 400);

  const client = await pool.connect();
  try {
    await ensureSchema(client);

    // upsert ingredient
    const ingRes = await client.query(`INSERT INTO ingredients (name, unit) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET unit = EXCLUDED.unit RETURNING id`, [ingredient, unit || null]);
    const ingredient_id = ingRes.rows[0].id;

    // check existing inventory
    const existing = await client.query(`SELECT id FROM inventory_items WHERE ingredient_id = $1`, [ingredient_id]);
    if (existing.rows.length > 0) {
      const id = existing.rows[0].id;
      const upd = await client.query(`UPDATE inventory_items SET supplier_id=$1, stock_quantity=$2, min_threshold=$3, expiry_date=$4, last_updated=NOW() WHERE id=$5 RETURNING *`, [supplier_id || null, stock_quantity, min_threshold, expiry_date || null, id]);
      return successResponse(res, upd.rows[0], "updated");
    }

    const insert = await client.query(`INSERT INTO inventory_items (ingredient_id, supplier_id, stock_quantity, min_threshold, expiry_date) VALUES ($1,$2,$3,$4,$5) RETURNING *`, [ingredient_id, supplier_id || null, stock_quantity, min_threshold, expiry_date || null]);
    return successResponse(res, insert.rows[0], "created");
  } catch (err) {
    return errorResponse(res, err.message);
  } finally {
    client.release();
  }
}));

// GET /api/inventory/low?threshold=10
router.get("/low", asyncHandler(async (req, res) => {
  const threshold = Number(req.query.threshold) || 10;
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    const result = await client.query(`
      SELECT i.id, ing.name as ingredient, i.stock_quantity, i.min_threshold, i.expiry_date, s.name as supplier
      FROM inventory_items i
      JOIN ingredients ing ON i.ingredient_id = ing.id
      LEFT JOIN suppliers s ON i.supplier_id = s.id
      WHERE i.stock_quantity <= $1
      ORDER BY i.stock_quantity ASC
    `, [threshold]);
    return successResponse(res, result.rows);
  } catch (err) {
    return errorResponse(res, err.message);
  } finally {
    client.release();
  }
}));

// Suppliers endpoints
router.get("/suppliers", asyncHandler(async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    const r = await client.query(`SELECT * FROM suppliers ORDER BY name`);
    return successResponse(res, r.rows);
  } catch (err) {
    return errorResponse(res, err.message);
  } finally { client.release(); }
}));

router.post("/suppliers", asyncHandler(async (req, res) => {
  const { name, contact, email, phone, address } = req.body;
  if (!name) return errorResponse(res, "name required", 400);
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    const r = await client.query(`INSERT INTO suppliers (name, contact, email, phone, address) VALUES ($1,$2,$3,$4,$5) RETURNING *`, [name, contact || null, email || null, phone || null, address || null]);
    return successResponse(res, r.rows[0]);
  } catch (err) {
    return errorResponse(res, err.message);
  } finally { client.release(); }
}));

export default router;
