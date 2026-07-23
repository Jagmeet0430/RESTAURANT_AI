import express from "express";
import { pool } from "../config/database.js";
import { successResponse, errorResponse, asyncHandler } from "../utils/index.js";
import { ensureNotificationTable } from "../services/orderLifecycleService.js";

const router = express.Router();

router.get(
  "/customer/:customerId",
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
  asyncHandler(async (req, res) => {
    await ensureNotificationTable();

    const customer = await pool.query("SELECT id FROM customers WHERE phone = $1", [req.params.phone]);

    if (customer.rows.length === 0) {
      return errorResponse(res, "Customer not found", 404);
    }

    const result = await pool.query(
      `SELECT n.id, n.customer_id, n.order_id, n.type, n.title, n.message, n.is_read, n.created_at
       FROM customer_notifications n
       WHERE n.customer_id = $1
       ORDER BY n.created_at DESC
       LIMIT 30`,
      [customer.rows[0].id]
    );

    return successResponse(res, result.rows, "Customer notifications retrieved");
  })
);

export default router;
