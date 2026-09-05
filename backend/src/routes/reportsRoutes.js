import express from "express";
import { pool } from "../config/database.js";
import { successResponse, errorResponse, asyncHandler } from "../utils/index.js";
import { authMiddleware, authorizeRoles } from "../middleware/index.js";

const router = express.Router();
const reportRoles = authorizeRoles(["admin", "staff"]);
const adminOnly = authorizeRoles(["admin"]);
const EXCEL_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const validFormats = new Set(["pdf", "excel"]);

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString("en-IN");
};

const formatMoney = (value) => `Rs. ${Number(value || 0).toFixed(2)}`;

const numberFields = (row, fields) => {
  const mapped = { ...row };
  fields.forEach((field) => {
    mapped[field] = Number(mapped[field] || 0);
  });
  return mapped;
};

const validateFormat = (res, format) => {
  if (validFormats.has(format)) return true;
  errorResponse(res, "Invalid format. Use pdf or excel.", 400);
  return false;
};

const sendExcel = async ({ res, filename, sheetName, headers, rows }) => {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(row));
  res.setHeader("Content-Type", EXCEL_CONTENT_TYPE);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
};

const startPdf = async (res, filename, title) => {
  const PDFDocument = (await import("pdfkit")).default;
  const doc = new PDFDocument({ margin: 36, size: "A4" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  doc.pipe(res);
  doc.fontSize(20).fillColor("#111827").text(title, { align: "center" });
  doc.fontSize(10).fillColor("#6b7280").text(
    `Generated on ${new Date().toLocaleString("en-IN")}`,
    { align: "center" }
  );
  doc.moveDown();
  doc.fontSize(10).fillColor("#111827");
  return doc;
};

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

  rows.forEach((row, index) => renderRow(row, index));
};

const salesSourceSql = `
  SELECT
    'restaurant_order' AS source,
    id::text AS sale_id,
    created_at,
    COALESCE(subtotal, 0) AS subtotal,
    COALESCE(discount, 0) AS discount,
    COALESCE(tax, 0) AS tax,
    COALESCE(delivery_charge, 0) AS delivery_charge,
    COALESCE(total_amount, 0) AS total_amount,
    1::int AS transactions,
    customer_id,
    customer_phone,
    payment_method,
    payment_status
  FROM orders
  WHERE COALESCE(status, '') <> 'Cancelled'

  UNION ALL

  SELECT
    'counter_sale' AS source,
    id::text AS sale_id,
    created_at,
    COALESCE(subtotal, 0) AS subtotal,
    0::numeric AS discount,
    COALESCE(gst_amount, 0) AS tax,
    0::numeric AS delivery_charge,
    COALESCE(total_amount, 0) AS total_amount,
    1::int AS transactions,
    NULL::int AS customer_id,
    customer_phone,
    payment_method,
    'Paid' AS payment_status
  FROM counter_sales
`;

const buildDateRange = (query, alias = "sales") => {
  const where = [];
  const params = [];

  if (query.from && Number.isNaN(Date.parse(query.from))) {
    const error = new Error("Invalid from date");
    error.statusCode = 400;
    throw error;
  }

  if (query.to && Number.isNaN(Date.parse(query.to))) {
    const error = new Error("Invalid to date");
    error.statusCode = 400;
    throw error;
  }

  if (query.from) {
    params.push(query.from);
    where.push(`${alias}.created_at >= $${params.length}::date`);
  }

  if (query.to) {
    params.push(query.to);
    where.push(`${alias}.created_at < ($${params.length}::date + INTERVAL '1 day')`);
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
    params,
  };
};

const queryDailySales = (client) =>
  client.query(`
    SELECT
      DATE(sales.created_at) AS date,
      COUNT(*)::int AS transactions,
      COUNT(*)::int AS orders,
      COUNT(*) FILTER (WHERE source = 'restaurant_order')::int AS restaurant_orders,
      COUNT(*) FILTER (WHERE source = 'counter_sale')::int AS counter_sales,
      COALESCE(SUM(total_amount), 0) AS sales,
      COALESCE(SUM(total_amount), 0) AS combined_revenue,
      COALESCE(SUM(total_amount) FILTER (WHERE source = 'restaurant_order'), 0) AS restaurant_orders_revenue,
      COALESCE(SUM(total_amount) FILTER (WHERE source = 'counter_sale'), 0) AS counter_sales_revenue,
      COALESCE(AVG(total_amount), 0) AS average_order_value,
      COALESCE(SUM(subtotal), 0) AS gross_sales,
      COALESCE(SUM(discount), 0) AS discount,
      COALESCE(SUM(tax), 0) AS tax,
      COALESCE(SUM(delivery_charge), 0) AS delivery_charge,
      COALESCE(SUM(total_amount), 0) AS net_payable
    FROM (${salesSourceSql}) sales
    WHERE sales.created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY DATE(sales.created_at)
    ORDER BY DATE(sales.created_at)
  `);

const queryWeeklySales = (client) =>
  client.query(`
    SELECT
      date_trunc('week', sales.created_at)::date AS week_start,
      COUNT(*)::int AS transactions,
      COUNT(*)::int AS orders,
      COUNT(*) FILTER (WHERE source = 'restaurant_order')::int AS restaurant_orders,
      COUNT(*) FILTER (WHERE source = 'counter_sale')::int AS counter_sales,
      COALESCE(SUM(total_amount), 0) AS sales,
      COALESCE(SUM(total_amount), 0) AS combined_revenue,
      COALESCE(SUM(total_amount) FILTER (WHERE source = 'restaurant_order'), 0) AS restaurant_orders_revenue,
      COALESCE(SUM(total_amount) FILTER (WHERE source = 'counter_sale'), 0) AS counter_sales_revenue,
      COALESCE(AVG(total_amount), 0) AS average_order_value
    FROM (${salesSourceSql}) sales
    WHERE sales.created_at >= CURRENT_DATE - INTERVAL '12 weeks'
    GROUP BY week_start
    ORDER BY week_start
  `);

const queryMonthlySales = (client) =>
  client.query(`
    SELECT
      date_trunc('month', sales.created_at)::date AS month_start,
      COUNT(*)::int AS transactions,
      COUNT(*)::int AS orders,
      COUNT(*) FILTER (WHERE source = 'restaurant_order')::int AS restaurant_orders,
      COUNT(*) FILTER (WHERE source = 'counter_sale')::int AS counter_sales,
      COALESCE(SUM(total_amount), 0) AS sales,
      COALESCE(SUM(total_amount), 0) AS combined_revenue,
      COALESCE(SUM(total_amount) FILTER (WHERE source = 'restaurant_order'), 0) AS restaurant_orders_revenue,
      COALESCE(SUM(total_amount) FILTER (WHERE source = 'counter_sale'), 0) AS counter_sales_revenue,
      COALESCE(AVG(total_amount), 0) AS average_order_value
    FROM (${salesSourceSql}) sales
    WHERE sales.created_at >= (date_trunc('month', CURRENT_DATE) - INTERVAL '11 months')
    GROUP BY month_start
    ORDER BY month_start
  `);

const querySalesSummary = (client, intervalSql = "30 days") =>
  client.query(`
    SELECT
      COALESCE(SUM(total_amount), 0) AS revenue,
      COALESCE(SUM(total_amount), 0) AS combined_revenue,
      COALESCE(SUM(total_amount) FILTER (WHERE source = 'restaurant_order'), 0) AS restaurant_orders_revenue,
      COALESCE(SUM(total_amount) FILTER (WHERE source = 'counter_sale'), 0) AS counter_sales_revenue,
      COUNT(*)::int AS transactions,
      COUNT(*) FILTER (WHERE source = 'restaurant_order')::int AS restaurant_orders,
      COUNT(*) FILTER (WHERE source = 'counter_sale')::int AS counter_sales,
      COUNT(DISTINCT customer_id) FILTER (WHERE customer_id IS NOT NULL)::int AS customers,
      COALESCE(AVG(total_amount), 0) AS avg_order_value,
      COALESCE(SUM(subtotal), 0) AS gross_sales,
      COALESCE(SUM(discount), 0) AS discount,
      COALESCE(SUM(tax), 0) AS tax,
      COALESCE(SUM(delivery_charge), 0) AS delivery_charge,
      COALESCE(SUM(total_amount), 0) AS net_payable
    FROM (${salesSourceSql}) sales
    WHERE created_at >= CURRENT_DATE - INTERVAL '${intervalSql}'
  `);

const queryTopMenuItems = (client) =>
  client.query(`
    SELECT
      m.id AS menu_id,
      m.name,
      COALESCE(SUM(oi.quantity), 0)::int AS quantity,
      COALESCE(SUM(oi.total_price), 0) AS revenue
    FROM order_items oi
    JOIN menu m ON oi.menu_id = m.id
    JOIN orders o ON oi.order_id = o.id
    WHERE COALESCE(o.status, '') <> 'Cancelled'
    GROUP BY m.id, m.name
    ORDER BY quantity DESC, revenue DESC, m.name ASC
    LIMIT 25
  `);

const queryTopProducts = (client) =>
  client.query(`
    SELECT
      p.id AS product_id,
      p.name,
      p.barcode,
      COALESCE(SUM(csi.quantity), 0)::int AS quantity,
      COALESCE(SUM(csi.line_total), 0) AS revenue
    FROM counter_sale_items csi
    JOIN products p ON p.id = csi.product_id
    JOIN counter_sales cs ON cs.id = csi.sale_id
    GROUP BY p.id, p.name, p.barcode
    ORDER BY quantity DESC, revenue DESC, p.name ASC
    LIMIT 25
  `);

const queryInventory = (client) =>
  client.query(`
    SELECT
      i.id,
      i.ingredient_name,
      i.ingredient_name AS ingredient,
      i.quantity AS stock_quantity,
      i.minimum_level AS min_threshold,
      i.expiry_date,
      s.name AS supplier,
      i.is_active,
      CASE
        WHEN i.quantity <= 0 THEN 'Out of stock'
        WHEN i.quantity <= i.minimum_level THEN 'Low stock'
        WHEN i.expiry_date IS NOT NULL AND i.expiry_date < CURRENT_DATE THEN 'Expired'
        WHEN i.expiry_date IS NOT NULL AND i.expiry_date <= CURRENT_DATE + INTERVAL '3 days' THEN 'Expiring soon'
        ELSE 'Healthy'
      END AS status
    FROM inventory i
    LEFT JOIN suppliers s ON i.supplier_id = s.id
    WHERE COALESCE(i.is_active, TRUE) = TRUE
    ORDER BY i.ingredient_name
  `);

const queryCustomerMetrics = (client) =>
  client.query(`
    SELECT
      c.id,
      c.name,
      c.email,
      c.phone,
      COALESCE(c.loyalty_points, 0)::int AS loyalty_points,
      COALESCE(c.total_orders, 0)::int AS cached_total_orders,
      COALESCE(c.total_spent, 0) AS cached_total_spent,
      COUNT(o.id) FILTER (WHERE COALESCE(o.status, '') <> 'Cancelled')::int AS aggregate_total_orders,
      COALESCE(SUM(o.total_amount) FILTER (WHERE COALESCE(o.status, '') <> 'Cancelled'), 0) AS aggregate_total_spent
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id
    GROUP BY c.id
    ORDER BY aggregate_total_spent DESC, cached_total_spent DESC, c.id DESC
    LIMIT 100
  `);

router.get(
  "/sales",
  authMiddleware,
  reportRoles,
  asyncHandler(async (req, res) => {
    const client = await pool.connect();
    try {
      const dailyRes = await queryDailySales(client);
      const weeklyRes = await queryWeeklySales(client);
      const monthlyRes = await queryMonthlySales(client);
      const currentSummaryRes = await querySalesSummary(client);
      const previousSummaryRes = await client.query(`
          SELECT
            COALESCE(SUM(total_amount), 0) AS revenue,
            COUNT(*)::int AS transactions
          FROM (${salesSourceSql}) sales
          WHERE created_at >= CURRENT_DATE - INTERVAL '60 days'
            AND created_at < CURRENT_DATE - INTERVAL '30 days'
        `);
      const peakHoursRes = await client.query(`
          SELECT
            EXTRACT(HOUR FROM created_at)::int AS hour,
            COUNT(*)::int AS transactions
          FROM (${salesSourceSql}) sales
          WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
          GROUP BY hour
          ORDER BY transactions DESC, hour ASC
          LIMIT 4
        `);
      const recentRes = await client.query(`
          SELECT
            DATE(created_at) AS date,
            COUNT(*)::int AS orders_count,
            COUNT(DISTINCT customer_id) FILTER (WHERE customer_id IS NOT NULL)::int AS customers,
            COUNT(*) FILTER (WHERE source = 'restaurant_order')::int AS restaurant_orders,
            COUNT(*) FILTER (WHERE source = 'counter_sale')::int AS counter_sales,
            COALESCE(AVG(total_amount), 0) AS avg_order_value,
            COALESCE(SUM(total_amount), 0) AS sales
          FROM (${salesSourceSql}) sales
          WHERE created_at >= CURRENT_DATE - INTERVAL '6 days'
          GROUP BY DATE(created_at)
          ORDER BY DATE(created_at)
        `);

      const currentSummary = currentSummaryRes.rows[0] || {};
      const previousSummary = previousSummaryRes.rows[0] || {};
      const currentRevenue = Number(currentSummary.revenue || 0);
      const previousRevenue = Number(previousSummary.revenue || 0);
      const currentTransactions = Number(currentSummary.transactions || 0);
      const previousTransactions = Number(previousSummary.transactions || 0);
      const percentageChange = (current, previous) => {
        if (!previous) return current > 0 ? 100 : 0;
        return Number((((current - previous) / previous) * 100).toFixed(1));
      };

      return successResponse(res, {
        daily: dailyRes.rows.map((row) =>
          numberFields(row, [
            "transactions",
            "orders",
            "restaurant_orders",
            "counter_sales",
            "sales",
            "combined_revenue",
            "restaurant_orders_revenue",
            "counter_sales_revenue",
            "average_order_value",
            "gross_sales",
            "discount",
            "tax",
            "delivery_charge",
            "net_payable",
          ])
        ),
        weekly: weeklyRes.rows.map((row) =>
          numberFields(row, [
            "transactions",
            "orders",
            "restaurant_orders",
            "counter_sales",
            "sales",
            "combined_revenue",
            "restaurant_orders_revenue",
            "counter_sales_revenue",
            "average_order_value",
          ])
        ),
        monthly: monthlyRes.rows.map((row) =>
          numberFields(row, [
            "transactions",
            "orders",
            "restaurant_orders",
            "counter_sales",
            "sales",
            "combined_revenue",
            "restaurant_orders_revenue",
            "counter_sales_revenue",
            "average_order_value",
          ])
        ),
        recent: recentRes.rows.map((row) =>
          numberFields(row, [
            "orders_count",
            "customers",
            "restaurant_orders",
            "counter_sales",
            "avg_order_value",
            "sales",
          ])
        ),
        predictions: recentRes.rows.map((row) => ({
          date: row.date,
          actual: Number(row.sales || 0),
          predicted: null,
        })),
        summary: {
          revenue: currentRevenue,
          combined_revenue: Number(currentSummary.combined_revenue || 0),
          restaurant_orders_revenue: Number(currentSummary.restaurant_orders_revenue || 0),
          counter_sales_revenue: Number(currentSummary.counter_sales_revenue || 0),
          transactions: currentTransactions,
          orders: Number(currentSummary.restaurant_orders || 0),
          counter_sales: Number(currentSummary.counter_sales || 0),
          customers: Number(currentSummary.customers || 0),
          avg_order_value: Number(currentSummary.avg_order_value || 0),
          gross_sales: Number(currentSummary.gross_sales || 0),
          discount: Number(currentSummary.discount || 0),
          tax: Number(currentSummary.tax || 0),
          delivery_charge: Number(currentSummary.delivery_charge || 0),
          net_payable: Number(currentSummary.net_payable || 0),
          changes: {
            revenue: percentageChange(currentRevenue, previousRevenue),
            orders: percentageChange(currentTransactions, previousTransactions),
            customers: 0,
          },
          peak_hours: peakHoursRes.rows,
        },
      });
    } catch (err) {
      console.error(err);
      return errorResponse(res, err.message || "Failed to generate report", err.statusCode || 500);
    } finally {
      client.release();
    }
  })
);

router.get("/daily-sales", authMiddleware, reportRoles, asyncHandler(async (req, res) => {
  const client = await pool.connect();
  try {
    const { whereSql, params } = buildDateRange(req.query, "sales");
    const result = await client.query(
      `
        SELECT
          DATE(created_at) AS date,
          COUNT(*)::int AS transactions,
          COALESCE(SUM(total_amount), 0) AS revenue,
          COALESCE(AVG(total_amount), 0) AS average_order_value
        FROM (${salesSourceSql}) sales
        ${whereSql}
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at)
      `,
      params
    );
    return successResponse(
      res,
      result.rows.map((row) => numberFields(row, ["transactions", "revenue", "average_order_value"]))
    );
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  } finally {
    client.release();
  }
}));

router.get("/weekly-sales", authMiddleware, reportRoles, asyncHandler(async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await queryWeeklySales(client);
    return successResponse(
      res,
      result.rows.map((row) =>
        numberFields(row, [
          "transactions",
          "orders",
          "restaurant_orders",
          "counter_sales",
          "sales",
          "combined_revenue",
          "restaurant_orders_revenue",
          "counter_sales_revenue",
          "average_order_value",
        ])
      )
    );
  } finally {
    client.release();
  }
}));

router.get("/monthly-sales", authMiddleware, reportRoles, asyncHandler(async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await queryMonthlySales(client);
    return successResponse(
      res,
      result.rows.map((row) =>
        numberFields(row, [
          "transactions",
          "orders",
          "restaurant_orders",
          "counter_sales",
          "sales",
          "combined_revenue",
          "restaurant_orders_revenue",
          "counter_sales_revenue",
          "average_order_value",
        ])
      )
    );
  } finally {
    client.release();
  }
}));

router.get("/top-menu-items", authMiddleware, reportRoles, asyncHandler(async (req, res) => {
  const result = await queryTopMenuItems(pool);
  return successResponse(res, result.rows.map((row) => numberFields(row, ["quantity", "revenue"])));
}));

router.get("/top-products", authMiddleware, reportRoles, asyncHandler(async (req, res) => {
  const result = await queryTopProducts(pool);
  return successResponse(res, result.rows.map((row) => numberFields(row, ["quantity", "revenue"])));
}));

router.get("/counter-sales", authMiddleware, reportRoles, asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT id, bill_number, customer_name, customer_phone, payment_method,
           subtotal, gst_amount, total_amount, created_at
    FROM counter_sales
    ORDER BY created_at DESC, id DESC
    LIMIT 100
  `);
  return successResponse(
    res,
    result.rows.map((row) => numberFields(row, ["subtotal", "gst_amount", "total_amount"]))
  );
}));

router.get("/customers", authMiddleware, adminOnly, asyncHandler(async (req, res) => {
  const result = await queryCustomerMetrics(pool);
  return successResponse(
    res,
    result.rows.map((row) =>
      numberFields(row, [
        "loyalty_points",
        "cached_total_orders",
        "cached_total_spent",
        "aggregate_total_orders",
        "aggregate_total_spent",
      ])
    )
  );
}));

router.get("/inventory", authMiddleware, reportRoles, asyncHandler(async (req, res) => {
  const result = await queryInventory(pool);
  return successResponse(res, result.rows.map((row) => numberFields(row, ["stock_quantity", "min_threshold"])));
}));

router.get("/products", authMiddleware, reportRoles, asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT
      p.id,
      p.name,
      p.barcode,
      p.quantity,
      p.minimum_stock,
      p.purchase_price,
      p.selling_price,
      COALESCE(s.name, p.supplier_name) AS supplier,
      p.expiry_date,
      p.is_active
    FROM products p
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    WHERE p.is_active = TRUE
    ORDER BY p.name
  `);
  return successResponse(
    res,
    result.rows.map((row) =>
      numberFields(row, ["quantity", "minimum_stock", "purchase_price", "selling_price"])
    )
  );
}));

router.get("/inventory/transactions", authMiddleware, reportRoles, asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT
      t.id,
      t.inventory_id,
      t.product_id,
      COALESCE(i.ingredient_name, p.name) AS item_name,
      t.transaction_type,
      t.quantity,
      t.quantity_before,
      t.quantity_after,
      t.reference_type,
      t.reference_id,
      t.reference_number,
      t.notes,
      t.created_at
    FROM inventory_transactions t
    LEFT JOIN inventory i ON i.id = t.inventory_id
    LEFT JOIN products p ON p.id = t.product_id
    ORDER BY t.created_at DESC, t.id DESC
    LIMIT 100
  `);
  return successResponse(
    res,
    result.rows.map((row) => numberFields(row, ["quantity", "quantity_before", "quantity_after"]))
  );
}));

router.get("/payments", authMiddleware, reportRoles, asyncHandler(async (req, res) => {
  const [payments, summary] = await Promise.all([
    pool.query(`
      SELECT id, order_id, customer_id, gateway, payment_method, amount,
             currency, payment_status, paid_at, created_at
      FROM payments
      ORDER BY created_at DESC, id DESC
      LIMIT 100
    `),
    pool.query(`
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE LOWER(payment_status) IN ('paid', 'captured')), 0) AS paid_total,
        COALESCE(SUM(amount) FILTER (WHERE LOWER(payment_status) = 'failed'), 0) AS failed_total,
        COUNT(*)::int AS payment_count
      FROM payments
    `),
  ]);
  return successResponse(res, {
    summary: numberFields(summary.rows[0] || {}, ["paid_total", "failed_total", "payment_count"]),
    payments: payments.rows.map((row) => numberFields(row, ["amount"])),
  });
}));

router.get("/coupons", authMiddleware, adminOnly, asyncHandler(async (req, res) => {
  const [coupons, summary] = await Promise.all([
    pool.query(`
      SELECT id, code, description, discount_type, discount_value,
             minimum_order_value, maximum_discount_value, usage_limit,
             used_count, usage_per_customer, start_date, expiry_date,
             is_active, created_at
      FROM coupons
      ORDER BY created_at DESC, id DESC
      LIMIT 100
    `),
    pool.query(`
      SELECT
        COUNT(*)::int AS total_coupons,
        COUNT(*) FILTER (WHERE is_active = TRUE)::int AS active_coupons,
        COUNT(*) FILTER (WHERE expiry_date < CURRENT_TIMESTAMP)::int AS expired_coupons,
        COALESCE(SUM(used_count), 0)::int AS total_used_count
      FROM coupons
    `),
  ]);
  return successResponse(res, {
    summary: numberFields(summary.rows[0] || {}, [
      "total_coupons",
      "active_coupons",
      "expired_coupons",
      "total_used_count",
    ]),
    coupons: coupons.rows.map((row) =>
      numberFields(row, [
        "discount_value",
        "minimum_order_value",
        "maximum_discount_value",
        "usage_limit",
        "used_count",
        "usage_per_customer",
      ])
    ),
  });
}));

router.get("/reconciliation", authMiddleware, reportRoles, asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT
      (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE COALESCE(status, '') <> 'Cancelled') AS restaurant_order_revenue,
      (SELECT COALESCE(SUM(total_amount), 0) FROM counter_sales) AS counter_sale_revenue,
      (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE COALESCE(status, '') <> 'Cancelled')
        + (SELECT COALESCE(SUM(total_amount), 0) FROM counter_sales) AS combined_revenue,
      (SELECT COALESCE(SUM(quantity), 0)::int FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE COALESCE(o.status, '') <> 'Cancelled') AS restaurant_items_sold,
      (SELECT COALESCE(SUM(quantity), 0)::int FROM counter_sale_items) AS pos_products_sold,
      (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE LOWER(payment_status) IN ('paid', 'captured')) AS paid_payment_total,
      (SELECT COUNT(*)::int FROM inventory_transactions) AS inventory_transaction_count,
      (SELECT COUNT(*)::int FROM customers) AS customer_count
  `);
  return successResponse(
    res,
    numberFields(result.rows[0] || {}, [
      "restaurant_order_revenue",
      "counter_sale_revenue",
      "combined_revenue",
      "restaurant_items_sold",
      "pos_products_sold",
      "paid_payment_total",
      "inventory_transaction_count",
      "customer_count",
    ])
  );
}));

router.get(
  "/all/export",
  authMiddleware,
  adminOnly,
  asyncHandler(async (req, res) => {
    const client = await pool.connect();
    try {
      const dailyRes = await queryDailySales(client);
      const weeklyRes = await queryWeeklySales(client);
      const monthlyRes = await queryMonthlySales(client);
      const topFoodRes = await queryTopMenuItems(client);
      const summaryRes = await querySalesSummary(client);
      const inventoryRes = await queryInventory(client);
      const customersRes = await queryCustomerMetrics(client);

      const summary = summaryRes.rows[0] || {};
      const revenue = Number(summary.revenue || 0);
      const estimatedProfit = revenue * 0.35;
      const doc = await startPdf(res, "restaurantai_all_reports.pdf", "RestaurantAI - All Reports");

      addSectionTitle(doc, "Executive Summary");
      doc.text(`Combined revenue (last 30 days): ${formatMoney(revenue)}`);
      doc.text(`Restaurant orders: ${Number(summary.restaurant_orders || 0)}`);
      doc.text(`Counter sales: ${Number(summary.counter_sales || 0)}`);
      doc.text(`Customers (restaurant orders): ${Number(summary.customers || 0)}`);
      doc.text(`Estimated profit at 35% margin: ${formatMoney(estimatedProfit)}`);

      addSectionTitle(doc, "Daily Sales");
      addRows(doc, dailyRes.rows, "No daily sales found.", (row) => {
        doc.text(`${formatDate(row.date)} - ${row.transactions} transactions - ${formatMoney(row.sales)}`);
      });

      addSectionTitle(doc, "Weekly Sales");
      addRows(doc, weeklyRes.rows, "No weekly sales found.", (row) => {
        doc.text(`Week of ${formatDate(row.week_start)} - ${row.transactions} transactions - ${formatMoney(row.sales)}`);
      });

      addSectionTitle(doc, "Monthly Sales");
      addRows(doc, monthlyRes.rows, "No monthly sales found.", (row) => {
        doc.text(`${formatDate(row.month_start)} - ${row.transactions} transactions - ${formatMoney(row.sales)}`);
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
          `${row.name} - ${row.phone || "N/A"} - orders ${row.aggregate_total_orders || 0} - spent ${formatMoney(row.aggregate_total_spent)}`
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

router.get(
  "/sales/export",
  authMiddleware,
  reportRoles,
  asyncHandler(async (req, res) => {
    const format = String(req.query.format || "pdf").toLowerCase();
    if (!validateFormat(res, format)) return;

    const client = await pool.connect();
    try {
      const result = await queryDailySales(client);
      const rows = result.rows;

      if (format === "excel") {
        await sendExcel({
          res,
          filename: "daily_sales.xlsx",
          sheetName: "Daily Sales",
          headers: [
            "Date",
            "Transactions",
            "Restaurant Revenue",
            "Counter Revenue",
            "Combined Revenue",
            "Tax",
          ],
          rows: rows.map((row) => [
            row.date,
            row.transactions,
            Number(row.restaurant_orders_revenue),
            Number(row.counter_sales_revenue),
            Number(row.sales),
            Number(row.tax),
          ]),
        });
        return;
      }

      const doc = await startPdf(res, "daily_sales.pdf", "Daily Sales (30 days)");
      addRows(doc, rows, "No daily sales found.", (row) => {
        doc.text(`${formatDate(row.date)} - ${row.transactions} transactions - ${formatMoney(row.sales)}`);
      });
      doc.end();
    } catch (err) {
      console.error(err);
      return errorResponse(res, err.message || "Export failed", 500);
    } finally {
      client.release();
    }
  })
);

router.get(
  "/sales/all/export",
  authMiddleware,
  reportRoles,
  asyncHandler(async (req, res) => {
    const client = await pool.connect();
    try {
      const summaryRes = await querySalesSummary(client);
      const dailyRes = await queryDailySales(client);
      const weeklyRes = await queryWeeklySales(client);
      const monthlyRes = await queryMonthlySales(client);
      const topFoodRes = await queryTopMenuItems(client);
      const topProductsRes = await queryTopProducts(client);
      const transactionsRes = await client.query(`
            SELECT source, sale_id, created_at, payment_status, payment_method, total_amount
            FROM (${salesSourceSql}) sales
            ORDER BY created_at DESC
            LIMIT 200
          `);

      const summary = summaryRes.rows[0] || {};
      const doc = await startPdf(res, "restaurantai_all_sales.pdf", "RestaurantAI - All Sales Report");

      addSectionTitle(doc, "Sales Summary");
      doc.text(`Combined revenue: ${formatMoney(summary.revenue)}`);
      doc.text(`Restaurant order revenue: ${formatMoney(summary.restaurant_orders_revenue)}`);
      doc.text(`Counter sale revenue: ${formatMoney(summary.counter_sales_revenue)}`);
      doc.text(`Transactions: ${Number(summary.transactions || 0)}`);
      doc.text(`Average transaction value: ${formatMoney(summary.avg_order_value)}`);
      doc.text(`Tax collected: ${formatMoney(summary.tax)}`);

      addSectionTitle(doc, "Daily Sales");
      addRows(doc, dailyRes.rows, "No daily sales found.", (row) => {
        doc.text(`${formatDate(row.date)} - ${row.transactions} transactions - ${formatMoney(row.sales)}`);
      });

      addSectionTitle(doc, "Weekly Sales");
      addRows(doc, weeklyRes.rows, "No weekly sales found.", (row) => {
        doc.text(`Week of ${formatDate(row.week_start)} - ${row.transactions} transactions - ${formatMoney(row.sales)}`);
      });

      addSectionTitle(doc, "Monthly Sales");
      addRows(doc, monthlyRes.rows, "No monthly sales found.", (row) => {
        doc.text(`${formatDate(row.month_start)} - ${row.transactions} transactions - ${formatMoney(row.sales)}`);
      });

      addSectionTitle(doc, "Top Selling Food");
      addRows(doc, topFoodRes.rows, "No item sales found.", (row, index) => {
        doc.text(`${index + 1}. ${row.name} - ${row.quantity} sold - ${formatMoney(row.revenue)}`);
      });

      addSectionTitle(doc, "Top POS Products");
      addRows(doc, topProductsRes.rows, "No POS product sales found.", (row, index) => {
        doc.text(`${index + 1}. ${row.name} - ${row.quantity} sold - ${formatMoney(row.revenue)}`);
      });

      addSectionTitle(doc, "Sales Transactions");
      addRows(doc, transactionsRes.rows, "No sales transactions found.", (row) => {
        doc.text(
          `${formatDate(row.created_at)} - ${row.source} #${row.sale_id} - ${row.payment_method || "N/A"} / ${row.payment_status || "N/A"} - ${formatMoney(row.total_amount)}`
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

router.get(
  "/inventory/export",
  authMiddleware,
  reportRoles,
  asyncHandler(async (req, res) => {
    const format = String(req.query.format || "pdf").toLowerCase();
    if (!validateFormat(res, format)) return;

    const client = await pool.connect();
    try {
      const result = await queryInventory(client);
      const rows = result.rows;

      if (format === "excel") {
        await sendExcel({
          res,
          filename: "inventory.xlsx",
          sheetName: "Inventory",
          headers: ["Ingredient", "Stock", "Min Threshold", "Expiry Date", "Supplier", "Status"],
          rows: rows.map((row) => [
            row.ingredient,
            Number(row.stock_quantity),
            Number(row.min_threshold),
            row.expiry_date,
            row.supplier,
            row.status,
          ]),
        });
        return;
      }

      const doc = await startPdf(res, "inventory.pdf", "Inventory Report");
      addRows(doc, rows, "No inventory data found.", (row) => {
        doc.text(
          `${row.ingredient} - ${row.stock_quantity} (min ${row.min_threshold}) - ${row.supplier || "N/A"} - Expiry: ${row.expiry_date || "N/A"}`
        );
      });
      doc.end();
    } catch (err) {
      console.error(err);
      return errorResponse(res, err.message || "Export failed", 500);
    } finally {
      client.release();
    }
  })
);

router.get(
  "/customers/export",
  authMiddleware,
  adminOnly,
  asyncHandler(async (req, res) => {
    const format = String(req.query.format || "excel").toLowerCase();
    if (!validateFormat(res, format)) return;

    const client = await pool.connect();
    try {
      const result = await queryCustomerMetrics(client);
      const rows = result.rows;

      if (format === "excel") {
        await sendExcel({
          res,
          filename: "customers.xlsx",
          sheetName: "Customers",
          headers: [
            "ID",
            "Name",
            "Email",
            "Phone",
            "Loyalty Points",
            "Cached Orders",
            "Cached Spent",
            "Aggregate Orders",
            "Aggregate Spent",
          ],
          rows: rows.map((row) => [
            row.id,
            row.name,
            row.email,
            row.phone,
            row.loyalty_points,
            row.cached_total_orders,
            Number(row.cached_total_spent),
            row.aggregate_total_orders,
            Number(row.aggregate_total_spent),
          ]),
        });
        return;
      }

      const doc = await startPdf(res, "customers.pdf", "Customers Report");
      addRows(doc, rows, "No customers found.", (row) => {
        doc.text(
          `${row.id} - ${row.name} - ${row.email || "N/A"} - ${row.phone} - Points: ${row.loyalty_points} - Orders: ${row.aggregate_total_orders} - Spend: ${formatMoney(row.aggregate_total_spent)}`
        );
      });
      doc.end();
    } catch (err) {
      console.error(err);
      return errorResponse(res, err.message || "Export failed", 500);
    } finally {
      client.release();
    }
  })
);

export default router;
