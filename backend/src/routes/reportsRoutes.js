import express from "express";
import axios from "axios";
import { pool } from "../config/database.js";
import { successResponse, errorResponse, asyncHandler } from "../utils/index.js";
import { authMiddleware, authorizeRoles } from "../middleware/index.js";

const router = express.Router();

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("en-IN");
};

const formatMoney = (value) => `Rs. ${Number(value || 0).toFixed(2)}`;

const addSectionTitle = (doc, title) => {
  doc.moveDown();
  doc.fontSize(15).fillColor("#111827").text(title, { underline: true });
  doc.moveDown(0.35);
  doc.fontSize(10).fillColor("#111827");
};

const addRows = (doc, rows, emptyText, renderRow) => {
  if (!rows.length) {
    doc.fontSize(10).fillColor("#6b7280").text(emptyText);
    doc.fillColor("#111827");
    return;
  }

  rows.forEach((row, index) => {
    renderRow(row, index);
  });
};

// Export all reports in one PDF: /api/reports/all/export
router.get(
  "/all/export",
  authMiddleware,
  authorizeRoles(["admin"]),
  asyncHandler(async (req, res) => {
    const client = await pool.connect();

    try {
      const [
        dailyRes,
        weeklyRes,
        monthlyRes,
        topFoodRes,
        summaryRes,
        inventoryRes,
        customersRes,
      ] = await Promise.all([
        client.query(`
          SELECT DATE(created_at) as date,
                 COUNT(*)::int as orders,
                 COALESCE(SUM(total_amount), 0) as revenue
          FROM orders
          WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
            AND COALESCE(status, '') <> 'Cancelled'
          GROUP BY DATE(created_at)
          ORDER BY DATE(created_at) DESC
          LIMIT 30
        `),
        client.query(`
          SELECT date_trunc('week', created_at)::date as week_start,
                 COUNT(*)::int as orders,
                 COALESCE(SUM(total_amount), 0) as revenue
          FROM orders
          WHERE created_at >= CURRENT_DATE - INTERVAL '12 weeks'
            AND COALESCE(status, '') <> 'Cancelled'
          GROUP BY week_start
          ORDER BY week_start DESC
          LIMIT 12
        `),
        client.query(`
          SELECT date_trunc('month', created_at)::date as month_start,
                 COUNT(*)::int as orders,
                 COALESCE(SUM(total_amount), 0) as revenue
          FROM orders
          WHERE created_at >= (date_trunc('month', CURRENT_DATE) - INTERVAL '11 months')
            AND COALESCE(status, '') <> 'Cancelled'
          GROUP BY month_start
          ORDER BY month_start DESC
          LIMIT 12
        `),
        client.query(`
          SELECT m.name,
                 COALESCE(SUM(oi.quantity), 0)::int as quantity,
                 COALESCE(SUM(oi.total_price), 0) as revenue
          FROM order_items oi
          JOIN menu m ON oi.menu_id = m.id
          JOIN orders o ON oi.order_id = o.id
          WHERE o.created_at >= CURRENT_DATE - INTERVAL '30 days'
            AND COALESCE(o.status, '') <> 'Cancelled'
          GROUP BY m.name
          ORDER BY quantity DESC, revenue DESC
          LIMIT 10
        `),
        client.query(`
          SELECT COALESCE(SUM(total_amount), 0) as revenue,
                 COUNT(*)::int as orders,
                 COUNT(DISTINCT customer_id)::int as customers
          FROM orders
          WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
            AND COALESCE(status, '') <> 'Cancelled'
        `),
        client.query(`
          SELECT ing.name as ingredient,
                 i.stock_quantity,
                 i.min_threshold,
                 i.expiry_date,
                 s.name as supplier
          FROM inventory_items i
          JOIN ingredients ing ON i.ingredient_id = ing.id
          LEFT JOIN suppliers s ON i.supplier_id = s.id
          ORDER BY ing.name
          LIMIT 50
        `).catch(() => ({ rows: [] })),
        client.query(`
          SELECT id, name, email, phone, loyalty_points, total_orders, total_spent
          FROM customers
          ORDER BY total_spent DESC
          LIMIT 50
        `),
      ]);

      const summary = summaryRes.rows[0] || {};
      const revenue = Number(summary.revenue || 0);
      const estimatedProfit = revenue * 0.35;

      const PDFDocument = (await import("pdfkit")).default;
      const doc = new PDFDocument({ margin: 36, size: "A4" });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="restaurantai_all_reports.pdf"');

      doc.pipe(res);

      doc.fontSize(20).fillColor("#111827").text("RestaurantAI - All Reports", { align: "center" });
      doc.fontSize(10).fillColor("#6b7280").text(`Generated on ${new Date().toLocaleString("en-IN")}`, {
        align: "center",
      });
      doc.moveDown();

      addSectionTitle(doc, "Executive Summary");
      doc.text(`Revenue (last 30 days): ${formatMoney(revenue)}`);
      doc.text(`Orders (last 30 days): ${Number(summary.orders || 0)}`);
      doc.text(`Customers (last 30 days): ${Number(summary.customers || 0)}`);
      doc.text(`Estimated profit at 35% margin: ${formatMoney(estimatedProfit)}`);

      addSectionTitle(doc, "Daily Sales");
      addRows(doc, dailyRes.rows, "No daily sales found.", (row) => {
        doc.text(`${formatDate(row.date)} - ${row.orders} orders - ${formatMoney(row.revenue)}`);
      });

      addSectionTitle(doc, "Weekly Sales");
      addRows(doc, weeklyRes.rows, "No weekly sales found.", (row) => {
        doc.text(`Week of ${formatDate(row.week_start)} - ${row.orders} orders - ${formatMoney(row.revenue)}`);
      });

      addSectionTitle(doc, "Monthly Sales");
      addRows(doc, monthlyRes.rows, "No monthly sales found.", (row) => {
        doc.text(`${formatDate(row.month_start)} - ${row.orders} orders - ${formatMoney(row.revenue)}`);
      });

      addSectionTitle(doc, "Top Selling Food");
      addRows(doc, topFoodRes.rows, "No selling food data found.", (row, index) => {
        doc.text(`${index + 1}. ${row.name} - ${row.quantity} sold - ${formatMoney(row.revenue)}`);
      });

      addSectionTitle(doc, "Inventory");
      addRows(doc, inventoryRes.rows, "No inventory data found.", (row) => {
        doc.text(
          `${row.ingredient} - stock ${row.stock_quantity ?? "-"} / min ${row.min_threshold ?? "-"} - supplier ${row.supplier || "N/A"}`
        );
      });

      addSectionTitle(doc, "Customers");
      addRows(doc, customersRes.rows, "No customers found.", (row) => {
        doc.text(
          `${row.name} - ${row.phone || "N/A"} - orders ${row.total_orders || 0} - spent ${formatMoney(row.total_spent)}`
        );
      });

      doc.end();
    } catch (err) {
      console.error(err);
      return errorResponse(res, err.message || "All reports export failed", 500);
    } finally {
      client.release();
    }
  })
);

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

// Export all sales in one PDF: /api/reports/sales/all/export
router.get(
  "/sales/all/export",
  authMiddleware,
  authorizeRoles(["admin", "staff"]),
  asyncHandler(async (req, res) => {
    const client = await pool.connect();

    try {
      const [summaryRes, dailyRes, weeklyRes, monthlyRes, topFoodRes, transactionsRes] = await Promise.all([
        client.query(`
          SELECT COALESCE(SUM(total_amount), 0) as revenue,
                 COUNT(*)::int as orders,
                 COUNT(DISTINCT customer_id)::int as customers,
                 COALESCE(AVG(total_amount), 0) as avg_order_value
          FROM orders
          WHERE COALESCE(status, '') <> 'Cancelled'
        `),
        client.query(`
          SELECT DATE(created_at) as date,
                 COUNT(*)::int as orders,
                 COALESCE(SUM(total_amount), 0) as revenue
          FROM orders
          WHERE COALESCE(status, '') <> 'Cancelled'
          GROUP BY DATE(created_at)
          ORDER BY DATE(created_at) DESC
        `),
        client.query(`
          SELECT date_trunc('week', created_at)::date as week_start,
                 COUNT(*)::int as orders,
                 COALESCE(SUM(total_amount), 0) as revenue
          FROM orders
          WHERE COALESCE(status, '') <> 'Cancelled'
          GROUP BY week_start
          ORDER BY week_start DESC
        `),
        client.query(`
          SELECT date_trunc('month', created_at)::date as month_start,
                 COUNT(*)::int as orders,
                 COALESCE(SUM(total_amount), 0) as revenue
          FROM orders
          WHERE COALESCE(status, '') <> 'Cancelled'
          GROUP BY month_start
          ORDER BY month_start DESC
        `),
        client.query(`
          SELECT m.name,
                 COALESCE(SUM(oi.quantity), 0)::int as quantity,
                 COALESCE(SUM(oi.total_price), 0) as revenue
          FROM order_items oi
          JOIN menu m ON oi.menu_id = m.id
          JOIN orders o ON oi.order_id = o.id
          WHERE COALESCE(o.status, '') <> 'Cancelled'
          GROUP BY m.name
          ORDER BY quantity DESC, revenue DESC
          LIMIT 25
        `),
        client.query(`
          SELECT o.order_number,
                 o.created_at,
                 o.status,
                 o.payment_status,
                 o.payment_method,
                 o.total_amount,
                 c.name as customer_name,
                 c.phone as customer_phone
          FROM orders o
          JOIN customers c ON o.customer_id = c.id
          WHERE COALESCE(o.status, '') <> 'Cancelled'
          ORDER BY o.created_at DESC
        `),
      ]);

      const summary = summaryRes.rows[0] || {};
      const PDFDocument = (await import("pdfkit")).default;
      const doc = new PDFDocument({ margin: 36, size: "A4" });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="restaurantai_all_sales.pdf"');

      doc.pipe(res);

      doc.fontSize(20).fillColor("#111827").text("RestaurantAI - All Sales Report", { align: "center" });
      doc.fontSize(10).fillColor("#6b7280").text(`Generated on ${new Date().toLocaleString("en-IN")}`, {
        align: "center",
      });
      doc.moveDown();

      addSectionTitle(doc, "Sales Summary");
      doc.text(`Total revenue: ${formatMoney(summary.revenue)}`);
      doc.text(`Total orders: ${Number(summary.orders || 0)}`);
      doc.text(`Unique customers: ${Number(summary.customers || 0)}`);
      doc.text(`Average order value: ${formatMoney(summary.avg_order_value)}`);

      addSectionTitle(doc, "Daily Sales");
      addRows(doc, dailyRes.rows, "No daily sales found.", (row) => {
        doc.text(`${formatDate(row.date)} - ${row.orders} orders - ${formatMoney(row.revenue)}`);
      });

      addSectionTitle(doc, "Weekly Sales");
      addRows(doc, weeklyRes.rows, "No weekly sales found.", (row) => {
        doc.text(`Week of ${formatDate(row.week_start)} - ${row.orders} orders - ${formatMoney(row.revenue)}`);
      });

      addSectionTitle(doc, "Monthly Sales");
      addRows(doc, monthlyRes.rows, "No monthly sales found.", (row) => {
        doc.text(`${formatDate(row.month_start)} - ${row.orders} orders - ${formatMoney(row.revenue)}`);
      });

      addSectionTitle(doc, "Top Selling Food");
      addRows(doc, topFoodRes.rows, "No item sales found.", (row, index) => {
        doc.text(`${index + 1}. ${row.name} - ${row.quantity} sold - ${formatMoney(row.revenue)}`);
      });

      addSectionTitle(doc, "Sales Transactions");
      addRows(doc, transactionsRes.rows, "No sales transactions found.", (row) => {
        doc.text(
          `${formatDate(row.created_at)} - ${row.order_number} - ${row.customer_name} (${row.customer_phone || "N/A"}) - ${row.status} / ${row.payment_status} - ${formatMoney(row.total_amount)}`
        );
      });

      doc.end();
    } catch (err) {
      console.error(err);
      return errorResponse(res, err.message || "All sales export failed", 500);
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

      const currentSummaryQ = `
        SELECT
          COALESCE(SUM(total_amount), 0) as revenue,
          COUNT(*)::int as orders,
          COUNT(DISTINCT customer_id)::int as customers
        FROM orders
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
          AND COALESCE(status, '') <> 'Cancelled'
      `;

      const previousSummaryQ = `
        SELECT
          COALESCE(SUM(total_amount), 0) as revenue,
          COUNT(*)::int as orders,
          COUNT(DISTINCT customer_id)::int as customers
        FROM orders
        WHERE created_at >= CURRENT_DATE - INTERVAL '60 days'
          AND created_at < CURRENT_DATE - INTERVAL '30 days'
          AND COALESCE(status, '') <> 'Cancelled'
      `;

      const peakHoursQ = `
        SELECT
          EXTRACT(HOUR FROM created_at)::int as hour,
          COUNT(*)::int as orders
        FROM orders
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
          AND COALESCE(status, '') <> 'Cancelled'
        GROUP BY hour
        ORDER BY orders DESC, hour ASC
        LIMIT 4
      `;

      const [dailyRes, weeklyRes, monthlyRes, currentSummaryRes, previousSummaryRes, peakHoursRes] = await Promise.all([
        client.query(dailyQ),
        client.query(weeklyQ),
        client.query(monthlyQ),
        client.query(currentSummaryQ),
        client.query(previousSummaryQ),
        client.query(peakHoursQ),
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

      const currentSummary = currentSummaryRes.rows[0] || {};
      const previousSummary = previousSummaryRes.rows[0] || {};

      const percentageChange = (currentValue, previousValue) => {
        const current = Number(currentValue) || 0;
        const previous = Number(previousValue) || 0;

        if (previous === 0) {
          return current > 0 ? 100 : 0;
        }

        return Number((((current - previous) / previous) * 100).toFixed(1));
      };

      return successResponse(res, {
        daily: dailyRes.rows,
        weekly: weeklyRes.rows,
        monthly: monthlyRes.rows,
        recent: recentRes.rows,
        predictions,
        summary: {
          revenue: Number(currentSummary.revenue) || 0,
          orders: Number(currentSummary.orders) || 0,
          customers: Number(currentSummary.customers) || 0,
          changes: {
            revenue: percentageChange(currentSummary.revenue, previousSummary.revenue),
            orders: percentageChange(currentSummary.orders, previousSummary.orders),
            customers: percentageChange(currentSummary.customers, previousSummary.customers),
          },
          peak_hours: peakHoursRes.rows,
        },
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
