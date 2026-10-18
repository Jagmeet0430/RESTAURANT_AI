import express from "express";
import { pool } from "../config/database.js";
import { successResponse, errorResponse, asyncHandler } from "../utils/index.js";
import { ensureNotificationTable } from "../services/orderLifecycleService.js";
import { authMiddleware, authorizeRoles } from '../middleware/index.js';
import { requireVerifiedPhoneToken } from '../services/otpService.js';
import { normalizePhoneNumber } from '../utils/phoneNumber.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.get(
  "/customer/:customerId",
  authMiddleware, authorizeRoles(['admin', 'staff', 'manager']),
  asyncHandler(async (req, res) => {
    await ensureNotificationTable();

    const result = await pool.query(
      `SELECT id, customer_id, order_id, type, title, message, is_read, created_at
       FROM customer_notifications
       WHERE customer_id = $1
       ORDER BY created_at DESC
       LIMIT 30`,
      [req.params.customerId]
    );

    return successResponse(res, result.rows, "Customer notifications retrieved");
  })
);

router.get(
  "/phone/:phone",
  createRateLimiter({ windowMs: 60000, max: 30, keyPrefix: 'notification:phone' }),
  asyncHandler(async (req, res) => {
    const phone = normalizePhoneNumber(req.params.phone);
    await requireVerifiedPhoneToken(phone, String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''),
      { consume: false, allowConsumed: true });
    await ensureNotificationTable();

    const customer = await pool.query("SELECT id FROM customers WHERE phone = $1", [phone]);

    if (customer.rows.length === 0) {
      return errorResponse(res, "Customer not found", 404);
    }

    const result = await pool.query(
      `SELECT n.id, n.customer_id, n.order_id, n.type, n.title, n.message, n.is_read, n.created_at
       FROM customer_notifications n
       JOIN orders o ON o.id = n.order_id
       WHERE n.customer_id = $1 AND o.customer_phone = $2
       ORDER BY n.created_at DESC
       LIMIT 30`,
      [customer.rows[0].id, phone]
    );

    return successResponse(res, result.rows, "Customer notifications retrieved");
  })
);

export default router;
