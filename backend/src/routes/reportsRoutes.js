import express from "express";
import axios from "axios";
import { pool } from "../config/database.js";
import { successResponse, errorResponse, asyncHandler } from "../utils/index.js";
import { authMiddleware, authorizeRoles } from "../middleware/index.js";

const router = express.Router();

// Export endpoints: /api/reports/sales/export?format=pdf|excel
router.get(
  "/sales/export",
  authMiddleware,
  authorizeRoles(["admin", "staff"]),
  asyncHandler(async (req, res) => {
    const format = (req.query.format || "pdf").toLowerCase();
    const client = await pool.connect();
    try {
      const q = `SELECT DATE(created_at) as date, COALESCE(SUM(total_amount),0) as sales FROM orders WHERE created_at >= CURRENT_DATE - INTERVAL '30 days' GROUP BY DATE(created_at) ORDER BY DATE(created_at)`;
      const result = await client.query(q);
      const rows = result.rows;

      if (format === "excel") {
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Daily Sales');
        sheet.addRow(['Date', 'Sales']);
        rows.forEach(r => sheet.addRow([r.date, Number(r.sales)]));
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="daily_sales.xlsx"');
        await workbook.xlsx.write(res);
        res.end();
        return;
      }

      // Default PDF
      const PDFDocument = (await import('pdfkit')).default;
      const doc = new PDFDocument({ margin: 30 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="daily_sales.pdf"');
      doc.pipe(res);
      doc.fontSize(18).text('Daily Sales (30 days)', { align: 'center' });
      doc.moveDown();
      rows.forEach(r => {
        doc.fontSize(12).text(`${r.date} — ₹${Number(r.sales).toFixed(2)}`);
      });
      doc.end();
    } catch (err) {
      console.error(err);
      return errorResponse(res, err.message || 'Export failed', 500);
    } finally {
      client.release();
    }
  })
);

// Inventory export
router.get(
  "/inventory/export",
  authMiddleware,
  authorizeRoles(["admin", "staff"]),
  asyncHandler(async (req, res) => {
    const format = (req.query.format || "pdf").toLowerCase();
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS suppliers (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255)
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS ingredients (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255)
        )
      `);

      const q = `
        SELECT ing.name as ingredient, i.stock_quantity, i.min_threshold, i.expiry_date, s.name as supplier
        FROM inventory_items i
        JOIN ingredients ing ON i.ingredient_id = ing.id
        LEFT JOIN suppliers s ON i.supplier_id = s.id
        ORDER BY ing.name
      `;
      const result = await client.query(q);
      const rows = result.rows;

      if (format === 'excel') {
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Inventory');
        sheet.addRow(['Ingredient','Stock','Min Threshold','Expiry Date','Supplier']);
        rows.forEach(r => sheet.addRow([r.ingredient, r.stock_quantity, r.min_threshold, r.expiry_date, r.supplier]));
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="inventory.xlsx"');
        await workbook.xlsx.write(res);
        res.end();
        return;
      }

      const PDFDocument = (await import('pdfkit')).default;
      const doc = new PDFDocument({ margin: 30 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="inventory.pdf"');
      doc.pipe(res);
      doc.fontSize(18).text('Inventory Report', { align: 'center' });
      doc.moveDown();
      rows.forEach(r => doc.fontSize(12).text(`${r.ingredient} — ${r.stock_quantity} (min ${r.min_threshold}) — ${r.supplier || 'N/A'} — Expiry: ${r.expiry_date || 'N/A'}`));
      doc.end();
    } catch (err) {
      console.error(err);
      return errorResponse(res, err.message || 'Export failed', 500);
    } finally {
      client.release();
    }
  })
);

// Customers export
router.get(
  "/customers/export",
  authMiddleware,
  authorizeRoles(["admin"]),
  asyncHandler(async (req, res) => {
    const format = (req.query.format || 'excel').toLowerCase();
    const client = await pool.connect();
    try {
      const q = `SELECT id, name, email, phone, loyalty_points, total_orders, total_spent FROM customers ORDER BY total_spent DESC`;
      const result = await client.query(q);
      const rows = result.rows;

      if (format === 'excel') {
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Customers');
        sheet.addRow(['ID','Name','Email','Phone','Loyalty Points','Total Orders','Total Spent']);
        rows.forEach(r => sheet.addRow([r.id, r.name, r.email, r.phone, r.loyalty_points, r.total_orders, Number(r.total_spent)]));
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="customers.xlsx"');
        await workbook.xlsx.write(res);
        res.end();
        return;
      }

      const PDFDocument = (await import('pdfkit')).default;
      const doc = new PDFDocument({ margin: 30 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="customers.pdf"');
      doc.pipe(res);
      doc.fontSize(18).text('Customers Report', { align: 'center' });
      doc.moveDown();
      rows.forEach(r => doc.fontSize(12).text(`${r.id} — ${r.name} — ${r.email || 'N/A'} — ${r.phone} — Points: ${r.loyalty_points} — Orders: ${r.total_orders} — Spend: ₹${Number(r.total_spent).toFixed(2)}`));
      doc.end();
    } catch (err) {
      console.error(err);
      return errorResponse(res, err.message || 'Export failed', 500);
    } finally {
      client.release();
    }
  })
);

// GET /api/reports/sales
router.get(
  "/sales",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const client = await pool.connect();
    try {
      // Daily - last 30 days
      const dailyQ = `
        SELECT DATE(created_at) as date, COALESCE(SUM(total_amount),0) as sales
        FROM orders
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at)
      `;

      const weeklyQ = `
        SELECT date_trunc('week', created_at)::date as week_start, COALESCE(SUM(total_amount),0) as sales
        FROM orders
        WHERE created_at >= CURRENT_DATE - INTERVAL '12 weeks'
        GROUP BY week_start
        ORDER BY week_start
      `;

      const monthlyQ = `
        SELECT date_trunc('month', created_at)::date as month_start, COALESCE(SUM(total_amount),0) as sales
        FROM orders
        WHERE created_at >= (date_trunc('month', CURRENT_DATE) - INTERVAL '11 months')
        GROUP BY month_start
        ORDER BY month_start
      `;

      const [dailyRes, weeklyRes, monthlyRes] = await Promise.all([
        client.query(dailyQ),
        client.query(weeklyQ),
        client.query(monthlyQ),
      ]);

      // AI Prediction vs Actual for last 7 days
      const recentQ = `
        SELECT DATE(created_at) as date,
               COUNT(*) as orders_count,
               COUNT(DISTINCT customer_id) as customers,
               SUM(CASE WHEN delivery_address IS NOT NULL THEN 1 ELSE 0 END) as online_orders,
               SUM(CASE WHEN delivery_address IS NULL THEN 1 ELSE 0 END) as dine_in_orders,
               COALESCE(AVG(total_amount),0) as avg_order_value,
               COALESCE(SUM(total_amount),0) as sales
        FROM orders
        WHERE created_at >= CURRENT_DATE - INTERVAL '6 days'
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at)
      `;

      const recentRes = await client.query(recentQ);

      const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";

      // Prepare payloads and call AI for each recent day (limited to 7 days)
      const aiPromises = recentRes.rows.map((r) => {
        const d = new Date(r.date);
        const month = d.getMonth() + 1;
        const day = d.getDate();
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const day_of_week = dayNames[d.getDay()];
        const is_weekend = d.getDay() === 0 || d.getDay() === 6 ? 1 : 0;
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

        return axios
          .post(`${AI_SERVICE_URL}/predict`, payload, { timeout: 5000 })
          .then((resp) => ({ date: r.date, actual: Number(r.sales), predicted: resp.data.predicted_sales }))
          .catch(() => ({ date: r.date, actual: Number(r.sales), predicted: null }));
      });

      const predictions = await Promise.all(aiPromises);

      return successResponse(res, {
        daily: dailyRes.rows,
        weekly: weeklyRes.rows,
        monthly: monthlyRes.rows,
        recent: recentRes.rows,
        predictions,
      });
    } catch (err) {
      console.error(err);
      return errorResponse(res, err.message || "Failed to generate report", 500);
    } finally {
      client.release();
    }
  })
);

export default router;
