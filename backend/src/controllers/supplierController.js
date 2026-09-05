import { pool } from "../config/database.js";
import { asyncHandler } from "../utils/index.js";

export const getSuppliers = asyncHandler(async (req, res) => {
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

export const getSupplierById = asyncHandler(async (req, res) => {
  const result = await pool.query(
    `
      SELECT
        id,
        name,
        contact_person,
        phone,
        email,
        address,
        is_active,
        created_at,
        updated_at
      FROM suppliers
      WHERE id = $1
        AND is_active = TRUE
      LIMIT 1
    `,
    [req.params.id]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({
      success: false,
      message: "Supplier not found",
    });
  }

  return res.status(200).json({
    success: true,
    data: result.rows[0],
  });
});

export const createSupplier = asyncHandler(async (req, res) => {
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

export const updateSupplier = asyncHandler(async (req, res) => {
  const { name, contact_person, phone, email, address, is_active } = req.body;

  if (name !== undefined && !String(name).trim()) {
    return res.status(400).json({
      success: false,
      message: "Supplier name is required",
    });
  }

  const result = await pool.query(
    `
      UPDATE suppliers
      SET
        name = COALESCE($1, name),
        contact_person = COALESCE($2, contact_person),
        phone = COALESCE($3, phone),
        email = COALESCE($4, email),
        address = COALESCE($5, address),
        is_active = COALESCE($6, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
    `,
    [
      name !== undefined ? String(name).trim() : null,
      contact_person ?? null,
      phone ?? null,
      email ?? null,
      address ?? null,
      is_active,
      req.params.id,
    ]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({
      success: false,
      message: "Supplier not found",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Supplier updated successfully",
    data: result.rows[0],
  });
});

export const deleteSupplier = asyncHandler(async (req, res) => {
  const result = await pool.query(
    `
      UPDATE suppliers
      SET is_active = FALSE,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND is_active = TRUE
      RETURNING id
    `,
    [req.params.id]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({
      success: false,
      message: "Supplier not found",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Supplier deleted successfully",
  });
});
