import { pool } from "../src/config/database.js";

const result = await pool.query(`
  SELECT
    o.id,
    o.order_number,
    o.status,
    o.total_amount,
    o.created_at,
    c.name AS customer_name,
    c.phone AS customer_phone,
    COUNT(oi.id) AS item_count,
    json_agg(
      json_build_object(
        'menu_id', oi.menu_id,
        'name', m.name,
        'quantity', oi.quantity,
        'unit_price', oi.unit_price,
        'total_price', oi.total_price
      )
    ) FILTER (WHERE oi.id IS NOT NULL) AS items
  FROM orders o
  JOIN customers c
    ON c.id = o.customer_id
  LEFT JOIN order_items oi
    ON oi.order_id = o.id
  LEFT JOIN menu m
    ON m.id = oi.menu_id
  GROUP BY o.id, c.id
  ORDER BY o.created_at DESC
  LIMIT 10;
`);

console.table(result.rows);

await pool.end();
