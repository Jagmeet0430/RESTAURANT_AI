import express from "express";
import axios from "axios";
import { pool } from "../config/database.js";
import { successResponse, errorResponse, asyncHandler } from "../utils/index.js";

const router = express.Router();

// GET /api/recommendations/today
router.get(
  "/today",
  asyncHandler(async (req, res) => {
    const client = await pool.connect();
    try {
      // Historical average sales (30 days)
      const avgQ = `SELECT COALESCE(AVG(total_amount),0) as avg_sales FROM orders WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'`;
      const avgRes = await client.query(avgQ);
      const avg30 = Number(avgRes.rows[0].avg_sales) || 0;

      // Today's aggregated features (same as prediction route)
      const todayQ = `
        SELECT
          COUNT(*) as orders_count,
          COUNT(DISTINCT customer_id) as customers,
          SUM(CASE WHEN delivery_address IS NOT NULL THEN 1 ELSE 0 END) as online_orders,
          SUM(CASE WHEN delivery_address IS NULL THEN 1 ELSE 0 END) as dine_in_orders,
          AVG(total_amount) as avg_order_value
        FROM orders
        WHERE DATE(created_at) = CURRENT_DATE
      `;
      const todayRes = await client.query(todayQ);
      const r = todayRes.rows[0] || {};

      const now = new Date();
      const month = now.getMonth() + 1;
      const day = now.getDate();
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const day_of_week = dayNames[now.getDay()];
      const is_weekend = now.getDay() === 0 || now.getDay() === 6 ? 1 : 0;
      let season = "Summer";
      if ([12, 1, 2].includes(month)) season = "Winter";
      else if ([6, 7, 8, 9].includes(month)) season = "Monsoon";

      const payload = {
        month,
        day,
        day_of_week,
        season,
        is_weekend,
        is_holiday: 0,
        weather: "Sunny",
        temperature: 30,
        customers: Number(r.customers) || 0,
        online_orders: Number(r.online_orders) || 0,
        dine_in_orders: Number(r.dine_in_orders) || 0,
        avg_order_value: Number(r.avg_order_value) || 0,
        marketing_spend: 0,
        special_event: "No",
      };

      const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";
      const aiResp = await axios.post(`${AI_SERVICE_URL}/predict`, payload, { timeout: 10000 }).catch(() => null);
      const predicted = aiResp?.data?.predicted_sales ?? null;

      // Determine demand level
      let demand = "Normal";
      if (predicted != null && avg30 > 0) {
        if (predicted >= avg30 * 1.2) demand = "High";
        else if (predicted <= avg30 * 0.8) demand = "Low";
        else demand = "Expected";
      } else if (predicted != null && avg30 === 0) {
        demand = predicted > 1000 ? "High" : "Expected";
      }

      // Top items last 7 days
      const topQ = `
        SELECT m.name, SUM(oi.quantity) as qty
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN menu m ON oi.menu_id = m.id
        WHERE o.created_at >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY m.name
        ORDER BY qty DESC
        LIMIT 3
      `;
      const topRes = await client.query(topQ);
      const topItems = topRes.rows.map((r) => r.name);

      // Recommendations rules
      const recommendations = [];

      if (demand === "High") {
        if (topItems.length > 0) recommendations.push(`Increase stock for top items: ${topItems.join(", ")}`);
        else recommendations.push("Increase overall stock levels");
        recommendations.push("Schedule 2 extra chefs");
        recommendations.push("Promote desserts");
        const onlineProp = payload.customers ? payload.online_orders / payload.customers : 0;
        if (onlineProp < 0.5) recommendations.push("Offer online delivery discounts to boost online channel");
      } else if (demand === "Expected") {
        if (topItems.length > 0) recommendations.push(`Top items to monitor: ${topItems.join(", ")}`);
        recommendations.push("Keep staffing levels steady; prepare one extra chef on call");
      } else {
        recommendations.push("Demand low — consider promotions to increase orders (e.g., bundle offers)");
        recommendations.push("Optimize inventory to reduce waste");
      }

      return successResponse(res, {
        predicted_sales: predicted,
        avg_30: avg30,
        demand_level: demand,
        recommendations,
        payload,
      });
    } catch (err) {
      console.error(err);
      return errorResponse(res, err.message || "Failed to generate recommendations", 500);
    } finally {
      client.release();
    }
  })
);

export default router;
