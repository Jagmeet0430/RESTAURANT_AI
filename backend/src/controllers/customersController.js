// Customers Controller
import { pool } from "../config/database.js";
import { successResponse, errorResponse, asyncHandler } from "../utils/index.js";
import { createPhoneOtp, verifyPhoneOtp } from "../services/otpService.js";
import { normalizePhoneNumber, phoneLookupCandidates } from "../utils/phoneNumber.js";

const VALID_CUSTOMER_ORDER_WHERE = "COALESCE(status, '') <> 'Cancelled'";

const customerOrderTotalsCte = `
  WITH order_totals AS (
    SELECT
      customer_id,
      COUNT(*)::int AS total_orders,
      COALESCE(SUM(total_amount), 0) AS total_spent
    FROM orders
    WHERE customer_id IS NOT NULL
      AND ${VALID_CUSTOMER_ORDER_WHERE}
    GROUP BY customer_id
  )
`;

const customerMetricsFields = `
  c.id,
  c.name,
  c.email,
  c.phone,
  c.address,
  c.city,
  c.state,
  c.postal_code,
  c.country,
  COALESCE(c.loyalty_points, 0)::int AS loyalty_points,
  COALESCE(ot.total_orders, 0)::int AS total_orders,
  COALESCE(ot.total_spent, 0) AS total_spent,
  COALESCE(c.total_orders, 0)::int AS legacy_total_orders,
  COALESCE(c.total_spent, 0) AS legacy_total_spent,
  c.is_active,
  c.created_at
`;

async function queryCustomerSummary(params = [], whereSql = "c.is_active = true") {
  const result = await pool.query(
    `${customerOrderTotalsCte},
     matched_customers AS (
       SELECT c.id, c.name, COALESCE(ot.total_orders, 0)::int AS total_orders, COALESCE(ot.total_spent, 0) AS total_spent
       FROM customers c
       LEFT JOIN order_totals ot ON ot.customer_id = c.id
       WHERE ${whereSql}
     )
     SELECT
       COUNT(*)::int AS total_customers,
       COALESCE(SUM(total_orders), 0)::int AS total_orders,
       COALESCE(SUM(total_spent), 0) AS total_spent,
       (
         SELECT json_build_object(
           'id', id,
           'name', name,
           'total_orders', total_orders,
           'total_spent', total_spent
         )
         FROM matched_customers
         WHERE total_orders > 0
         ORDER BY total_spent DESC, total_orders DESC, id DESC
         LIMIT 1
       ) AS top_customer
     FROM matched_customers`,
    params
  );

  return {
    total_customers: Number(result.rows[0]?.total_customers || 0),
    total_orders: Number(result.rows[0]?.total_orders || 0),
    total_spent: Number(result.rows[0]?.total_spent || 0),
    top_customer: result.rows[0]?.top_customer || null,
  };
}

// Get all customers
export const getAllCustomers = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  const result = await pool.query(
    `${customerOrderTotalsCte}
     SELECT ${customerMetricsFields}
     FROM customers c
     LEFT JOIN order_totals ot ON ot.customer_id = c.id
     WHERE c.is_active = true
     ORDER BY COALESCE(ot.total_spent, 0) DESC, COALESCE(ot.total_orders, 0) DESC, c.id DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return res.status(200).json({
    success: true,
    message: "Customers retrieved successfully",
    data: result.rows,
    summary: await queryCustomerSummary(),
  });
});

// Get customer by ID
export const getCustomerById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const customerResult = await pool.query(
    `${customerOrderTotalsCte}
     SELECT ${customerMetricsFields}
     FROM customers c
     LEFT JOIN order_totals ot ON ot.customer_id = c.id
     WHERE c.id = $1`,
    [id]
  );

  if (customerResult.rows.length === 0) {
    return errorResponse(res, "Customer not found", 404);
  }

  const customer = customerResult.rows[0];

  // Get customer's recent orders
  const ordersResult = await pool.query(
    `SELECT id, order_number, status, total_amount, created_at
     FROM orders
     WHERE customer_id = $1
     ORDER BY created_at DESC
     LIMIT 10`,
    [id]
  );

  // Get favorites (menu items)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_favorites (
      customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      menu_id INT NOT NULL REFERENCES menu(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (customer_id, menu_id)
    )
  `);

  const favRes = await pool.query(
    `SELECT cf.menu_id, m.name FROM customer_favorites cf JOIN menu m ON cf.menu_id = m.id WHERE cf.customer_id = $1`,
    [id]
  );

  return successResponse(
    res,
    { ...customer, recent_orders: ordersResult.rows, favorites: favRes.rows },
    "Customer retrieved successfully"
  );
});

// Get favorites for a customer
export const getFavorites = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_favorites (
      customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      menu_id INT NOT NULL REFERENCES menu(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (customer_id, menu_id)
    )
  `);

  const result = await pool.query(`SELECT cf.menu_id, m.name FROM customer_favorites cf JOIN menu m ON cf.menu_id = m.id WHERE cf.customer_id = $1`, [id]);
  return successResponse(res, result.rows);
});

// Add favorite
export const addFavorite = asyncHandler(async (req, res) => {
  const { id } = req.params; // customer id
  const { menu_id } = req.body;
  if (!menu_id) return errorResponse(res, "menu_id is required", 400);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_favorites (
      customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      menu_id INT NOT NULL REFERENCES menu(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (customer_id, menu_id)
    )
  `);

  try {
    const insert = await pool.query(`INSERT INTO customer_favorites (customer_id, menu_id) VALUES ($1,$2) RETURNING menu_id`, [id, menu_id]);
    return successResponse(res, insert.rows[0], "Favorite added");
  } catch (err) {
    if (err.code === '23505') return errorResponse(res, "Already favorited", 409);
    throw err;
  }
});

// Remove favorite
export const removeFavorite = asyncHandler(async (req, res) => {
  const { id, menuId } = req.params;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_favorites (
      customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      menu_id INT NOT NULL REFERENCES menu(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (customer_id, menu_id)
    )
  `);

  const del = await pool.query(`DELETE FROM customer_favorites WHERE customer_id=$1 AND menu_id=$2 RETURNING menu_id`, [id, menuId]);
  if (del.rows.length === 0) return errorResponse(res, "Favorite not found", 404);
  return successResponse(res, del.rows[0], "Favorite removed");
});

// Create new customer
export const createCustomer = asyncHandler(async (req, res) => {
  const { name, email, phone, address, city, state, postal_code, country } = req.body;

  // Validate required fields
  if (!name || !phone) {
    return errorResponse(res, "Name and phone are required", 400);
  }

  let normalizedPhone;
  let phoneCandidates;
  try {
    normalizedPhone = normalizePhoneNumber(phone);
    phoneCandidates = phoneLookupCandidates(phone);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 400);
  }

  // Check if customer already exists by phone
  const existing = await pool.query("SELECT id FROM customers WHERE phone = ANY($1::text[])", [phoneCandidates]);
  if (existing.rows.length > 0) {
    return errorResponse(res, "Customer with this phone number already exists", 409);
  }

  // Check if email is unique (if provided)
  if (email) {
    const emailCheck = await pool.query("SELECT id FROM customers WHERE email = $1", [email]);
    if (emailCheck.rows.length > 0) {
      return errorResponse(res, "Customer with this email already exists", 409);
    }
  }

  const result = await pool.query(
    `INSERT INTO customers (name, email, phone, address, city, state, postal_code, country, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
     RETURNING id, name, email, phone, address, city, state, postal_code, country, loyalty_points, total_orders, total_spent, is_active, created_at`,
    [name, email || null, normalizedPhone, address, city, state, postal_code, country]
  );

  return successResponse(res, result.rows[0], "Customer created successfully", 201);
});

export const sendCustomerOtp = asyncHandler(async (req, res) => {
  try {
    const otp = await createPhoneOtp(req.body.phone, { req });

    return successResponse(
      res,
      {
        phone: otp.phone,
        expires_at: otp.expires_at,
        resend_after_seconds: otp.resend_after_seconds,
      },
      "OTP sent to WhatsApp"
    );
  } catch (error) {
    if (error.retryAfter) res.set("Retry-After", String(error.retryAfter));
    return errorResponse(res, error.message, error.statusCode || 500);
  }
});

export const verifyCustomerOtp = asyncHandler(async (req, res) => {
  try {
    const verification = await verifyPhoneOtp({
      phone: req.body.phone,
      otp: req.body.otp,
      req,
    });

    return successResponse(res, verification, "Phone number verified successfully");
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
});

// Update customer
export const updateCustomer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, address, city, state, postal_code, country, is_active } = req.body;
  let normalizedPhone = null;

  // Check if customer exists
  const existing = await pool.query("SELECT id FROM customers WHERE id = $1", [id]);
  if (existing.rows.length === 0) {
    return errorResponse(res, "Customer not found", 404);
  }

  if (phone) {
    try {
      normalizedPhone = normalizePhoneNumber(phone);
    } catch (error) {
      return errorResponse(res, error.message, error.statusCode || 400);
    }

    const phoneCheck = await pool.query("SELECT id FROM customers WHERE phone = ANY($1::text[]) AND id != $2", [phoneLookupCandidates(phone), id]);
    if (phoneCheck.rows.length > 0) {
      return errorResponse(res, "Customer with this phone number already exists", 409);
    }
  }

  if (email) {
    const emailCheck = await pool.query("SELECT id FROM customers WHERE email = $1 AND id != $2", [email, id]);
    if (emailCheck.rows.length > 0) {
      return errorResponse(res, "Customer with this email already exists", 409);
    }
  }

  const result = await pool.query(
    `UPDATE customers
     SET name = COALESCE($1, name),
         email = COALESCE($2, email),
         phone = COALESCE($3, phone),
         address = COALESCE($4, address),
         city = COALESCE($5, city),
         state = COALESCE($6, state),
         postal_code = COALESCE($7, postal_code),
         country = COALESCE($8, country),
         is_active = COALESCE($9, is_active),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $10
     RETURNING id, name, email, phone, address, city, state, postal_code, country, loyalty_points, total_orders, total_spent, is_active, updated_at`,
    [name, email, normalizedPhone, address, city, state, postal_code, country, is_active, id]
  );

  const updatedCustomer = await pool.query(
    `${customerOrderTotalsCte}
     SELECT ${customerMetricsFields}, c.updated_at
     FROM customers c
     LEFT JOIN order_totals ot ON ot.customer_id = c.id
     WHERE c.id = $1`,
    [result.rows[0].id]
  );

  return successResponse(res, updatedCustomer.rows[0], "Customer updated successfully");
});

// Delete customer
export const deleteCustomer = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    `UPDATE customers
     SET is_active = false,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND is_active = true
     RETURNING id`,
    [id]
  );

  if (result.rows.length === 0) {
    return errorResponse(res, "Customer not found", 404);
  }

  return successResponse(res, { id: result.rows[0].id }, "Customer deleted successfully");
});

// Get customer by phone number
export const getCustomerByPhone = asyncHandler(async (req, res) => {
  const { phone } = req.params;
  let normalizedPhone;
  let phoneCandidates;
  try {
    normalizedPhone = normalizePhoneNumber(phone);
    phoneCandidates = phoneLookupCandidates(phone);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 400);
  }

  const result = await pool.query(
    `${customerOrderTotalsCte}
     SELECT ${customerMetricsFields}
     FROM customers c
     LEFT JOIN order_totals ot ON ot.customer_id = c.id
     WHERE c.phone = ANY($1::text[])
     ORDER BY c.phone = $2 DESC, c.id DESC
     LIMIT 1`,
    [phoneCandidates, normalizedPhone]
  );

  if (result.rows.length === 0) {
    return errorResponse(res, "Customer not found", 404);
  }

  return successResponse(res, result.rows[0], "Customer retrieved successfully");
});

// Get customer by email
export const getCustomerByEmail = asyncHandler(async (req, res) => {
  const { email } = req.params;

  const result = await pool.query(
    `${customerOrderTotalsCte}
     SELECT ${customerMetricsFields}
     FROM customers c
     LEFT JOIN order_totals ot ON ot.customer_id = c.id
     WHERE c.email = $1`,
    [email]
  );

  if (result.rows.length === 0) {
    return errorResponse(res, "Customer not found", 404);
  }

  return successResponse(res, result.rows[0], "Customer retrieved successfully");
});

// Add loyalty points
export const addLoyaltyPoints = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { points } = req.body;

  if (!points || points <= 0) {
    return errorResponse(res, "Valid points amount is required", 400);
  }

  const result = await pool.query(
    `UPDATE customers
     SET loyalty_points = loyalty_points + $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING loyalty_points`,
    [points, id]
  );

  if (result.rows.length === 0) {
    return errorResponse(res, "Customer not found", 404);
  }

  return successResponse(res, result.rows[0], "Loyalty points added successfully");
});

// Search customers
export const searchCustomers = asyncHandler(async (req, res) => {
  const { query } = req.query;

  if (!query || query.length < 2) {
    return errorResponse(res, "Search query must be at least 2 characters", 400);
  }

  const result = await pool.query(
    `${customerOrderTotalsCte}
     SELECT ${customerMetricsFields}
     FROM customers c
     LEFT JOIN order_totals ot ON ot.customer_id = c.id
     WHERE c.is_active = true AND (
       c.name ILIKE $1 OR
       c.email ILIKE $1 OR
       c.phone ILIKE $1 OR
       c.city ILIKE $1
     )
     ORDER BY COALESCE(ot.total_spent, 0) DESC, COALESCE(ot.total_orders, 0) DESC, c.id DESC`,
    [`%${query}%`]
  );

  return res.status(200).json({
    success: true,
    message: "Search results retrieved successfully",
    data: result.rows,
    summary: await queryCustomerSummary([`%${query}%`], `c.is_active = true AND (
       c.name ILIKE $1 OR
       c.email ILIKE $1 OR
       c.phone ILIKE $1 OR
       c.city ILIKE $1
     )`),
  });
});
