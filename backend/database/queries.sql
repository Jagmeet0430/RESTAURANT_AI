-- PostgreSQL to Node.js Query Examples
-- Use these patterns in your services layer

-- ============================================
-- MENU QUERIES
-- ============================================

-- 1. Get all menu items with category
SELECT 
  m.id, m.name, m.description, m.price, 
  m.veg_type, m.is_available, m.is_featured,
  c.name as category_name
FROM menu m
JOIN categories c ON m.category_id = c.id
WHERE m.is_available = true
ORDER BY c.display_order, m.name;

-- 2. Get menu by category
SELECT * FROM menu 
WHERE category_id = $1 AND is_available = true
ORDER BY name;

-- 3. Get featured items
SELECT m.*, c.name as category_name
FROM menu m
JOIN categories c ON m.category_id = c.id
WHERE m.is_featured = true AND m.is_available = true;

-- 4. Search menu
SELECT m.*, c.name as category_name
FROM menu m
JOIN categories c ON m.category_id = c.id
WHERE m.name ILIKE '%' || $1 || '%'
AND m.is_available = true;


-- ============================================
-- ORDER QUERIES
-- ============================================

-- 1. Get customer orders
SELECT o.*, c.name as customer_name
FROM orders o
JOIN customers c ON o.customer_id = c.id
WHERE o.customer_id = $1
ORDER BY o.created_at DESC;

-- 2. Get order with items
SELECT 
  o.*,
  json_agg(
    json_build_object(
      'id', oi.id,
      'menu_id', oi.menu_id,
      'item_name', m.name,
      'quantity', oi.quantity,
      'unit_price', oi.unit_price,
      'total_price', oi.total_price
    )
  ) as items
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
LEFT JOIN menu m ON oi.menu_id = m.id
WHERE o.id = $1
GROUP BY o.id;

-- 3. Get orders by status
SELECT * FROM orders
WHERE status = $1
ORDER BY created_at DESC;

-- 4. Get pending orders (for kitchen)
SELECT * FROM orders
WHERE status IN ('Pending', 'Accepted', 'Preparing', 'Ready')
ORDER BY created_at ASC;

-- 5. Create new order
INSERT INTO orders 
(customer_id, order_number, status, payment_status, subtotal, tax, delivery_charge, total_amount, special_instructions)
VALUES ($1, $2, 'Pending', 'Pending', $3, $4, $5, $6, $7)
RETURNING *;

-- 6. Update order status
UPDATE orders 
SET status = $2, updated_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING *;


-- ============================================
-- ORDER ITEMS QUERIES
-- ============================================

-- 1. Get order items
SELECT 
  oi.*,
  m.name,
  m.veg_type,
  m.category_id
FROM order_items oi
JOIN menu m ON oi.menu_id = m.id
WHERE oi.order_id = $1;

-- 2. Add item to order
INSERT INTO order_items (order_id, menu_id, quantity, unit_price, total_price)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;


-- ============================================
-- CUSTOMER QUERIES
-- ============================================

-- 1. Get customer by phone
SELECT * FROM customers 
WHERE phone = $1;

-- 2. Get customer by email
SELECT * FROM customers 
WHERE email = $1;

-- 3. Create new customer
INSERT INTO customers (name, email, phone, address, city, state, postal_code, country)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- 4. Update customer
UPDATE customers
SET name = $2, email = $3, address = $4, city = $5, state = $6, postal_code = $7
WHERE id = $1
RETURNING *;


-- ============================================
-- KITCHEN QUERIES
-- ============================================

-- 1. Get kitchen board (all active orders)
SELECT 
  o.id,
  o.order_number,
  o.status,
  COUNT(oi.id) as item_count,
  array_agg(m.name) as items,
  o.created_at,
  c.name as customer_name
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
LEFT JOIN menu m ON oi.menu_id = m.id
JOIN customers c ON o.customer_id = c.id
WHERE o.status IN ('Pending', 'Accepted', 'Preparing', 'Ready')
GROUP BY o.id, o.order_number, o.status, o.created_at, c.name
ORDER BY o.created_at ASC;

-- 2. Get orders for specific status column
SELECT * FROM orders
WHERE status = $1
ORDER BY created_at ASC;

-- 3. Update order status (kitchen)
UPDATE orders
SET status = $2, updated_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING *;


-- ============================================
-- ANALYTICS QUERIES
-- ============================================

-- 1. Daily sales
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_orders,
  SUM(total_amount) as revenue,
  AVG(total_amount) as avg_order_value
FROM orders
WHERE status = 'Completed'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- 2. Best selling items
SELECT 
  m.name,
  SUM(oi.quantity) as total_sold,
  SUM(oi.total_price) as revenue
FROM order_items oi
JOIN menu m ON oi.menu_id = m.id
JOIN orders o ON oi.order_id = o.id
WHERE o.status = 'Completed'
GROUP BY m.id, m.name
ORDER BY total_sold DESC
LIMIT 10;

-- 3. Category wise sales
SELECT 
  c.name,
  COUNT(*) as orders,
  SUM(oi.quantity) as items_sold,
  SUM(oi.total_price) as revenue
FROM order_items oi
JOIN menu m ON oi.menu_id = m.id
JOIN categories c ON m.category_id = c.id
JOIN orders o ON oi.order_id = o.id
WHERE o.status = 'Completed'
GROUP BY c.id, c.name
ORDER BY revenue DESC;

-- 4. Peak order hours
SELECT 
  EXTRACT(HOUR FROM created_at) as hour,
  COUNT(*) as orders
FROM orders
WHERE status = 'Completed'
GROUP BY EXTRACT(HOUR FROM created_at)
ORDER BY hour;

-- 5. Customer statistics
SELECT 
  COUNT(*) as total_customers,
  COUNT(DISTINCT customer_id) as customers_with_orders,
  AVG(total_orders) as avg_orders_per_customer,
  SUM(total_spent) as total_revenue
FROM customers;
