import express from "express";
import axios from "axios";
import { pool } from "../config/database.js";
import { successResponse, errorResponse, asyncHandler } from "../utils/index.js";

const router = express.Router();

// GET /api/predictions/today
router.get(
  "/today",
  asyncHandler(async (req, res) => {
    const client = await pool.connect();
    try {
      const todayQuery = `
        SELECT
          COUNT(*) as orders_count,
          COUNT(DISTINCT customer_id) as customers,
          SUM(CASE WHEN delivery_address IS NOT NULL THEN 1 ELSE 0 END) as online_orders,
          SUM(CASE WHEN delivery_address IS NULL THEN 1 ELSE 0 END) as dine_in_orders,
          AVG(total_amount) as avg_order_value
        FROM orders
        WHERE DATE(created_at) = CURRENT_DATE
      `;

      const result = await client.query(todayQuery);
      const row = result.rows[0] || {};

      const now = new Date();
      const month = now.getMonth() + 1;
      const day = now.getDate();
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const day_of_week = dayNames[now.getDay()];
      const is_weekend = now.getDay() === 0 || now.getDay() === 6 ? 1 : 0;

      // Simple season mapping
      let season = "Summer";
      if ([12, 1, 2].includes(month)) season = "Winter";
      else if ([6, 7, 8, 9].includes(month)) season = "Monsoon";

      const customers = Number(row.customers) || 0;
      const online_orders = Number(row.online_orders) || 0;
      const dine_in_orders = Number(row.dine_in_orders) || 0;
      const avg_order_value = Number(row.avg_order_value) || 0;

      // Defaults for fields not tracked in DB
      const payload = {
        month,
        day,
        day_of_week,
        season,
        is_weekend,
        is_holiday: 0,
        weather: "Sunny",
        temperature: 30,
        customers,
        online_orders,
        dine_in_orders,
        avg_order_value,
        marketing_spend: 0,
        special_event: "No",
      };

      const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";
      const aiResponse = await axios.post(`${AI_SERVICE_URL}/predict`, payload, { timeout: 10000 });

      return successResponse(res, { payload, predicted: aiResponse.data }, "Today's prediction retrieved");
    } catch (err) {
      return errorResponse(res, err.message || "Prediction error", 500);
    } finally {
      client.release();
    }
  })
);

export default router;
