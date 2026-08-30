import { pool } from "../config/database.js";
import { successResponse, errorResponse, asyncHandler } from "../utils/index.js";

let couponSchemaReady;

const ensureCouponSchema = () => {
  if (!couponSchemaReady) {
    couponSchemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS coupons (
          id SERIAL PRIMARY KEY,
          code VARCHAR(50) UNIQUE NOT NULL,
          description TEXT,
          discount_type VARCHAR(50) NOT NULL,
          discount_value DECIMAL(10, 2) NOT NULL,
          minimum_order_value DECIMAL(10, 2),
          maximum_discount_value DECIMAL(10, 2),
          usage_limit INT,
          used_count INT DEFAULT 0,
          usage_per_customer INT DEFAULT 1,
          start_date TIMESTAMP,
          expiry_date TIMESTAMP NOT NULL,
          is_active BOOLEAN DEFAULT true,
          created_by INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await pool.query("ALTER TABLE coupons ADD COLUMN IF NOT EXISTS description TEXT");
      await pool.query("ALTER TABLE coupons ADD COLUMN IF NOT EXISTS discount_type VARCHAR(50) NOT NULL DEFAULT 'Percentage'");
      await pool.query("ALTER TABLE coupons ADD COLUMN IF NOT EXISTS discount_value DECIMAL(10, 2) NOT NULL DEFAULT 0");
      await pool.query("ALTER TABLE coupons ADD COLUMN IF NOT EXISTS minimum_order_value DECIMAL(10, 2)");
      await pool.query("ALTER TABLE coupons ADD COLUMN IF NOT EXISTS maximum_discount_value DECIMAL(10, 2)");
      await pool.query("ALTER TABLE coupons ADD COLUMN IF NOT EXISTS usage_limit INT");
      await pool.query("ALTER TABLE coupons ADD COLUMN IF NOT EXISTS used_count INT DEFAULT 0");
      await pool.query("ALTER TABLE coupons ADD COLUMN IF NOT EXISTS usage_per_customer INT DEFAULT 1");
      await pool.query("ALTER TABLE coupons ADD COLUMN IF NOT EXISTS start_date TIMESTAMP");
      await pool.query("ALTER TABLE coupons ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 year')");
      await pool.query("ALTER TABLE coupons ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true");
      await pool.query("ALTER TABLE coupons ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
      await pool.query("ALTER TABLE coupons ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");

      await pool.query("CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code)");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active)");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_coupons_expiry ON coupons(expiry_date)");
    })().catch((error) => {
      couponSchemaReady = undefined;
      throw error;
    });
  }

  return couponSchemaReady;
};

const normalizeCoupon = (coupon) => ({
  ...coupon,
  discount_value: Number(coupon.discount_value),
  minimum_order_value: coupon.minimum_order_value === null ? null : Number(coupon.minimum_order_value),
  maximum_discount_value: coupon.maximum_discount_value === null ? null : Number(coupon.maximum_discount_value),
});

export const getAllCoupons = asyncHandler(async (req, res) => {
  await ensureCouponSchema();

  const result = await pool.query(
    `SELECT id, code, description, discount_type, discount_value, minimum_order_value,
            maximum_discount_value, usage_limit, used_count, expiry_date, is_active, created_at
     FROM coupons
     ORDER BY created_at DESC`
  );

  return successResponse(res, result.rows.map(normalizeCoupon), "Coupons retrieved successfully");
});

export const createCoupon = asyncHandler(async (req, res) => {
  await ensureCouponSchema();

  const {
    code,
    description,
    discount_type = "Percentage",
    discount_value,
    minimum_order_value,
    maximum_discount_value,
    usage_limit,
    expiry_date,
    is_active = true,
  } = req.body;

  if (!code || !discount_value || !expiry_date) {
    return errorResponse(res, "Code, discount value, and expiry date are required", 400);
  }

  const existing = await pool.query("SELECT id FROM coupons WHERE UPPER(code) = UPPER($1)", [code]);
  if (existing.rows.length > 0) {
    return errorResponse(res, "Coupon code already exists", 409);
  }

  const result = await pool.query(
    `INSERT INTO coupons (
       code, description, discount_type, discount_value, minimum_order_value,
       maximum_discount_value, usage_limit, expiry_date, is_active
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, code, description, discount_type, discount_value, minimum_order_value,
               maximum_discount_value, usage_limit, used_count, expiry_date, is_active, created_at`,
    [
      code.trim().toUpperCase(),
      description || null,
      discount_type,
      discount_value,
      minimum_order_value || null,
      maximum_discount_value || null,
      usage_limit || null,
      expiry_date,
      is_active,
    ]
  );

  return successResponse(res, normalizeCoupon(result.rows[0]), "Coupon created successfully", 201);
});

export const updateCoupon = asyncHandler(async (req, res) => {
  await ensureCouponSchema();

  const { id } = req.params;
  const {
    code,
    description,
    discount_type,
    discount_value,
    minimum_order_value,
    maximum_discount_value,
    usage_limit,
    expiry_date,
    is_active,
  } = req.body;

  const existing = await pool.query("SELECT id FROM coupons WHERE id = $1", [id]);
  if (existing.rows.length === 0) {
    return errorResponse(res, "Coupon not found", 404);
  }

  if (code) {
    const duplicate = await pool.query("SELECT id FROM coupons WHERE UPPER(code) = UPPER($1) AND id != $2", [code, id]);
    if (duplicate.rows.length > 0) {
      return errorResponse(res, "Coupon code already exists", 409);
    }
  }

  const result = await pool.query(
    `UPDATE coupons
     SET code = COALESCE($1, code),
         description = COALESCE($2, description),
         discount_type = COALESCE($3, discount_type),
         discount_value = COALESCE($4, discount_value),
         minimum_order_value = $5,
         maximum_discount_value = $6,
         usage_limit = $7,
         expiry_date = COALESCE($8, expiry_date),
         is_active = COALESCE($9, is_active),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $10
     RETURNING id, code, description, discount_type, discount_value, minimum_order_value,
               maximum_discount_value, usage_limit, used_count, expiry_date, is_active, created_at`,
    [
      code ? code.trim().toUpperCase() : null,
      description ?? null,
      discount_type,
      discount_value,
      minimum_order_value || null,
      maximum_discount_value || null,
      usage_limit || null,
      expiry_date,
      is_active,
      id,
    ]
  );

  return successResponse(res, normalizeCoupon(result.rows[0]), "Coupon updated successfully");
});

export const deleteCoupon = asyncHandler(async (req, res) => {
  await ensureCouponSchema();

  const { id } = req.params;

  const result = await pool.query(
    `UPDATE coupons
     SET is_active = false,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING id`,
    [id]
  );

  if (result.rows.length === 0) {
    return errorResponse(res, "Coupon not found", 404);
  }

  return successResponse(res, { id: result.rows[0].id }, "Coupon deleted successfully");
});
