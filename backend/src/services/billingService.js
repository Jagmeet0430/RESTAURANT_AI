import { pool } from "../config/database.js";

const BILL_PREFIX = "BILL";

async function queryWith(client, sql, params = []) {
  return client.query(sql, params);
}

export async function ensureBillingSchema(client = pool) {
  await queryWith(client, `
    CREATE TABLE IF NOT EXISTS bills (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      bill_number VARCHAR(80) UNIQUE NOT NULL,
      bill_type VARCHAR(30) NOT NULL DEFAULT 'order',
      customer_name VARCHAR(255),
      customer_phone VARCHAR(30),
      line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
      subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
      tax NUMERIC(12, 2) NOT NULL DEFAULT 0,
      delivery_charge NUMERIC(12, 2) NOT NULL DEFAULT 0,
      discount NUMERIC(12, 2) NOT NULL DEFAULT 0,
      total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
      payment_method VARCHAR(80),
      payment_status VARCHAR(50),
      created_by INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await queryWith(client, "CREATE UNIQUE INDEX IF NOT EXISTS idx_bills_order ON bills(order_id)");
  await queryWith(client, "CREATE INDEX IF NOT EXISTS idx_bills_created_at ON bills(created_at)");
}

async function generateBillNumber(client) {
  const result = await queryWith(client, "SELECT COUNT(*) AS count FROM bills");
  const count = Number(result.rows[0]?.count || 0) + 1;
  return `${BILL_PREFIX}-${Date.now()}-${count}`;
}

export async function createBillForOrder(client, { orderId, billType = "order", createdBy = null } = {}) {
  await ensureBillingSchema(client);

  const orderResult = await queryWith(
    client,
    `SELECT o.id, o.order_number, o.subtotal, o.tax, o.delivery_charge, o.discount,
            o.total_amount, o.payment_method, o.payment_status,
            c.name AS customer_name, c.phone AS customer_phone
     FROM orders o
     JOIN customers c ON c.id = o.customer_id
     WHERE o.id = $1`,
    [orderId]
  );

  if (orderResult.rowCount === 0) {
    const error = new Error("Order not found for billing");
    error.statusCode = 404;
    throw error;
  }

  const itemsResult = await queryWith(
    client,
    `SELECT oi.menu_id, m.name, oi.quantity, oi.unit_price, oi.total_price
     FROM order_items oi
     JOIN menu m ON m.id = oi.menu_id
     WHERE oi.order_id = $1
     ORDER BY oi.id ASC`,
    [orderId]
  );

  const order = orderResult.rows[0];
  const billNumber = await generateBillNumber(client);
  const lineItems = itemsResult.rows.map((item) => ({
    menu_id: Number(item.menu_id),
    name: item.name,
    quantity: Number(item.quantity),
    unit_price: Number(item.unit_price),
    total_price: Number(item.total_price),
  }));

  const billResult = await queryWith(
    client,
    `INSERT INTO bills (
       order_id, bill_number, bill_type, customer_name, customer_phone, line_items,
       subtotal, tax, delivery_charge, discount, total_amount, payment_method,
       payment_status, created_by
     )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, $14)
     ON CONFLICT (order_id)
     DO UPDATE SET
       line_items = EXCLUDED.line_items,
       subtotal = EXCLUDED.subtotal,
       tax = EXCLUDED.tax,
       delivery_charge = EXCLUDED.delivery_charge,
       discount = EXCLUDED.discount,
       total_amount = EXCLUDED.total_amount,
       payment_method = EXCLUDED.payment_method,
       payment_status = EXCLUDED.payment_status,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [
      order.id,
      billNumber,
      billType,
      order.customer_name,
      order.customer_phone,
      JSON.stringify(lineItems),
      order.subtotal,
      order.tax,
      order.delivery_charge,
      order.discount,
      order.total_amount,
      order.payment_method,
      order.payment_status,
      createdBy,
    ]
  );

  return billResult.rows[0];
}

export async function getBillByOrderId(client, orderId) {
  await ensureBillingSchema(client);

  const result = await queryWith(client, "SELECT * FROM bills WHERE order_id = $1", [orderId]);
  return result.rows[0] || null;
}
