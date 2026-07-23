import { pool } from "../config/database.js";
import { asyncHandler } from "../utils/index.js";

const ensureSupplierSchema = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      contact_person VARCHAR(120),
      phone VARCHAR(20),
      email VARCHAR(150),
      address TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    ALTER TABLE suppliers
      ADD COLUMN IF NOT EXISTS contact_person VARCHAR(120),
      ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
      ADD COLUMN IF NOT EXISTS email VARCHAR(150),
      ADD COLUMN IF NOT EXISTS address TEXT,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  `);
};

export const getSuppliers = asyncHandler(async (req, res) => {
  await ensureSupplierSchema();

  const result = await pool.query(`
    SELECT
      id,
      name,
      contact_person,
      phone,
      email,
      address
    FROM suppliers
    WHERE is_active = TRUE
    ORDER BY name ASC
  `);

  return res.status(200).json({
    success: true,
    count: result.rows.length,
    data: result.rows,
  });
});

export const createSupplier = asyncHandler(async (req, res) => {
  await ensureSupplierSchema();

  const { name, contact_person, phone, email, address } = req.body;

  if (!name) {
    return res.status(400).json({
      success: false,
      message: "Supplier name is required",
    });
  }

  const result = await pool.query(
    `
      INSERT INTO suppliers (name, contact_person, phone, email, address)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    [
      name.trim(),
      contact_person || null,
      phone || null,
      email || null,
      address || null,
    ]
  );

  return res.status(201).json({
    success: true,
    message: "Supplier added successfully",
    data: result.rows[0],
  });
});
