import { pool } from "../config/database.js";
import { asyncHandler, errorResponse, successResponse } from "../utils/index.js";
import {
  ensureTableQrSchema,
  generateUniqueTableToken,
  normalizeQrToken,
  resolveTableByToken,
} from "../services/tableQrService.js";

const ACTIVE_STATUSES = ["Confirmed", "Accepted", "Preparing", "Ready", "Out for Delivery"];

function cleanTableNumber(value) {
  return String(value || "").trim().slice(0, 20);
}

function cleanDisplayName(value, tableNumber) {
  const text = String(value || "").trim().slice(0, 80);
  return text || `Table ${tableNumber}`;
}

function cleanCapacity(value) {
  const capacity = Number(value);
  if (!Number.isInteger(capacity) || capacity < 1) return 4;
  return Math.min(capacity, 50);
}

function tableQrBaseUrl(req) {
  const configured = String(process.env.FRONTEND_URL || "").trim().replace(/\/+$/, "");
  if (configured) return configured;

  const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "http").split(",")[0];
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:5001";
  return `${proto}://${host}`;
}

function withQrUrl(req, table) {
  return {
    ...table,
    qr_url: `${tableQrBaseUrl(req)}/customer?table=${encodeURIComponent(table.qr_token)}`,
  };
}

function tableStatus(row) {
  if (!row.is_active) return "INACTIVE";
  if (Number(row.ready_orders || 0) > 0) return "READY";
  if (Number(row.payment_pending_orders || 0) > 0) return "PAYMENT PENDING";
  if (Number(row.active_orders || 0) > 0) return "ACTIVE ORDER";
  return "AVAILABLE";
}

export const getAllTables = asyncHandler(async (req, res) => {
  await ensureTableQrSchema();
  const result = await pool.query(
    `SELECT rt.id,
            rt.table_number,
            rt.display_name,
            rt.qr_token,
            rt.is_active,
            rt.capacity,
            rt.created_at,
            rt.updated_at,
            COUNT(o.id) FILTER (WHERE o.status = ANY($1))::int AS active_orders,
            COUNT(o.id) FILTER (WHERE o.status = 'Ready')::int AS ready_orders,
            COUNT(o.id) FILTER (
              WHERE o.status = ANY($1)
                AND COALESCE(o.payment_status, 'Pending') <> 'Paid'
            )::int AS payment_pending_orders,
            MAX(o.created_at) FILTER (WHERE o.status = ANY($1)) AS latest_active_order_at
     FROM restaurant_tables rt
     LEFT JOIN orders o ON o.table_id = rt.id
     GROUP BY rt.id
     ORDER BY NULLIF(regexp_replace(rt.table_number::text, '[^0-9]', '', 'g'), '')::int NULLS LAST,
              rt.table_number ASC`,
    [ACTIVE_STATUSES]
  );

  return successResponse(
    res,
    result.rows.map((row) => withQrUrl(req, { ...row, status_label: tableStatus(row) })),
    "Tables retrieved successfully"
  );
});

export const getTableById = asyncHandler(async (req, res) => {
  await ensureTableQrSchema();
  const result = await pool.query(
    `SELECT rt.*,
            COUNT(o.id) FILTER (WHERE o.status = ANY($2))::int AS active_orders,
            COUNT(o.id) FILTER (WHERE o.status = 'Ready')::int AS ready_orders,
            COUNT(o.id) FILTER (
              WHERE o.status = ANY($2)
                AND COALESCE(o.payment_status, 'Pending') <> 'Paid'
            )::int AS payment_pending_orders
     FROM restaurant_tables rt
     LEFT JOIN orders o ON o.table_id = rt.id
     WHERE rt.id = $1
     GROUP BY rt.id`,
    [req.params.id, ACTIVE_STATUSES]
  );

  if (!result.rows[0]) return errorResponse(res, "Table not found", 404);
  const table = result.rows[0];
  return successResponse(res, withQrUrl(req, { ...table, status_label: tableStatus(table) }), "Table retrieved successfully");
});

export const createTable = asyncHandler(async (req, res) => {
  await ensureTableQrSchema();
  const tableNumber = cleanTableNumber(req.body.table_number || req.body.tableNumber);
  if (!tableNumber) return errorResponse(res, "Table number is required", 400);

  const duplicate = await pool.query("SELECT id FROM restaurant_tables WHERE table_number = $1 LIMIT 1", [tableNumber]);
  if (duplicate.rows[0]) {
    return errorResponse(res, `Table ${tableNumber} already exists`, 409);
  }

  const result = await pool.query(
    `INSERT INTO restaurant_tables (table_number, display_name, qr_token, is_active, capacity)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      tableNumber,
      cleanDisplayName(req.body.display_name || req.body.displayName, tableNumber),
      await generateUniqueTableToken(),
      req.body.is_active !== false,
      cleanCapacity(req.body.capacity),
    ]
  );

  return successResponse(res, withQrUrl(req, { ...result.rows[0], active_orders: 0, ready_orders: 0, payment_pending_orders: 0, status_label: "AVAILABLE" }), "Table created successfully", 201);
});

export const updateTable = asyncHandler(async (req, res) => {
  await ensureTableQrSchema();
  const existing = await pool.query("SELECT * FROM restaurant_tables WHERE id = $1", [req.params.id]);
  if (!existing.rows[0]) return errorResponse(res, "Table not found", 404);

  const tableNumber = req.body.table_number || req.body.tableNumber;
  const nextTableNumber = tableNumber == null ? existing.rows[0].table_number : cleanTableNumber(tableNumber);
  if (!nextTableNumber) return errorResponse(res, "Table number is required", 400);

  const duplicate = await pool.query(
    "SELECT id FROM restaurant_tables WHERE table_number = $1 AND id <> $2 LIMIT 1",
    [nextTableNumber, req.params.id]
  );
  if (duplicate.rows[0]) {
    return errorResponse(res, `Table ${nextTableNumber} already exists`, 409);
  }

  const result = await pool.query(
    `UPDATE restaurant_tables
     SET table_number = $1,
         display_name = $2,
         capacity = $3,
         is_active = $4,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $5
     RETURNING *`,
    [
      nextTableNumber,
      cleanDisplayName(req.body.display_name || req.body.displayName, nextTableNumber),
      cleanCapacity(req.body.capacity ?? existing.rows[0].capacity),
      req.body.is_active == null ? existing.rows[0].is_active : req.body.is_active !== false,
      req.params.id,
    ]
  );

  return successResponse(res, withQrUrl(req, result.rows[0]), "Table updated successfully");
});

export const regenerateTableQr = asyncHandler(async (req, res) => {
  await ensureTableQrSchema();
  const existing = await pool.query("SELECT id FROM restaurant_tables WHERE id = $1", [req.params.id]);
  if (!existing.rows[0]) return errorResponse(res, "Table not found", 404);

  const result = await pool.query(
    `UPDATE restaurant_tables
     SET qr_token = $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING *`,
    [await generateUniqueTableToken(), req.params.id]
  );

  return successResponse(res, withQrUrl(req, result.rows[0]), "Table QR token regenerated successfully");
});

export const resolvePublicTable = asyncHandler(async (req, res) => {
  try {
    const table = await resolveTableByToken(pool, normalizeQrToken(req.params.token), { requireActive: true });
    return successResponse(
      res,
      {
        table_number: table.table_number,
        display_name: table.display_name,
        qr_token: table.qr_token,
      },
      "Table QR resolved successfully"
    );
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 404);
  }
});
