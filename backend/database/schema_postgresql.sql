-- RestaurantAI Database - PostgreSQL Version
-- Note: This file contains PostgreSQL syntax
-- For MySQL, use 'ENUM' and adjust data types accordingly

-- This schema should be run after creating the database:
-- CREATE DATABASE restaurantai;
-- \c restaurantai
-- \i schema.sql

-- ============================================
-- DROP EXISTING TABLES (if redeploying)
-- ============================================
-- Uncomment to start fresh (CAUTION: This will delete all data)
-- DROP TABLE IF EXISTS reviews CASCADE;
-- DROP TABLE IF EXISTS order_items CASCADE;
-- DROP TABLE IF EXISTS orders CASCADE;
-- DROP TABLE IF EXISTS coupons CASCADE;
-- DROP TABLE IF EXISTS menu CASCADE;
-- DROP TABLE IF EXISTS categories CASCADE;
-- DROP TABLE IF EXISTS customers CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

-- ============================================
-- 1. USERS TABLE (Admin Users)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);


-- ============================================
-- 2. CATEGORIES TABLE (Food Categories)
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    image_url VARCHAR(500),
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);


-- ============================================
-- 3. MENU TABLE (Food Items)
-- ============================================
CREATE TABLE IF NOT EXISTS menu (
    id SERIAL PRIMARY KEY,
    category_id INT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    veg_type VARCHAR(50) NOT NULL,
    image_url VARCHAR(500),
    is_available BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    preparation_time INT DEFAULT 20,
    calories INT,
    is_spicy BOOLEAN DEFAULT false,
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_menu_category ON menu(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_veg_type ON menu(veg_type);
CREATE INDEX IF NOT EXISTS idx_menu_available ON menu(is_available);


-- ============================================
-- 4. CUSTOMERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20) UNIQUE NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(10),
    country VARCHAR(100),
    loyalty_points INT DEFAULT 0,
    total_orders INT DEFAULT 0,
    total_spent DECIMAL(12, 2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);


-- ============================================
-- 5. ORDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending',
    payment_status VARCHAR(50) DEFAULT 'Pending',
    payment_method VARCHAR(50) DEFAULT 'Cash',
    subtotal DECIMAL(10, 2) NOT NULL,
    tax DECIMAL(10, 2) DEFAULT 0.00,
    delivery_charge DECIMAL(10, 2) DEFAULT 0.00,
    discount DECIMAL(10, 2) DEFAULT 0.00,
    total_amount DECIMAL(10, 2) NOT NULL,
    special_instructions TEXT,
    coupon_id INT REFERENCES coupons(id),
    delivery_address TEXT,
    estimated_delivery_time TIMESTAMP,
    actual_delivery_time TIMESTAMP,
    assigned_to INT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);


-- ============================================
-- 6. ORDER ITEMS TABLE (Junction Table)
-- ============================================
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_id INT NOT NULL REFERENCES menu(id),
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    special_instructions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu ON order_items(menu_id);


-- ============================================
-- 7. COUPONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS coupons (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    discount_type VARCHAR(50) NOT NULL,
    discount_value DECIMAL(10, 2) NOT NULL,
    minimum_order_value DECIMAL(10, 2),
    maximum_discount_value DECIMAL(10, 2),
    usage_limit INT,
    used_count INT DEFAULT 0,
    usage_per_customer INT DEFAULT 1,
    start_date TIMESTAMP,
    expiry_date TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active);
CREATE INDEX IF NOT EXISTS idx_coupons_expiry ON coupons(expiry_date);


-- ============================================
-- 8. ADMINS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);


-- ============================================
-- 9. STAFF TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS staff (
    id SERIAL PRIMARY KEY,
    admin_id INT REFERENCES admins(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email);
CREATE INDEX IF NOT EXISTS idx_staff_role ON staff(role);


-- ============================================
-- 10. MENU_ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS menu_items (
    id SERIAL PRIMARY KEY,
    category_id INT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    veg_type VARCHAR(50) NOT NULL,
    image_url VARCHAR(500),
    is_available BOOLEAN DEFAULT true,
    preparation_time INT DEFAULT 20,
    created_by INT REFERENCES admins(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(is_available);


-- ============================================
-- 11. RESTAURANT_TABLES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS restaurant_tables (
    id SERIAL PRIMARY KEY,
    table_number VARCHAR(20) UNIQUE NOT NULL,
    capacity INT DEFAULT 4,
    status VARCHAR(50) DEFAULT 'available',
    location VARCHAR(100),
    created_by INT REFERENCES admins(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_restaurant_tables_status ON restaurant_tables(status);


-- ============================================
-- 12. PAYMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    payment_method VARCHAR(50) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    transaction_id VARCHAR(100),
    payment_status VARCHAR(50) DEFAULT 'Pending',
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(payment_status);


-- ============================================
-- 13. INVENTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS inventory (
    id SERIAL PRIMARY KEY,
    menu_item_id INT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    stock_quantity INT DEFAULT 0,
    reorder_level INT DEFAULT 10,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INT REFERENCES staff(id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_menu_item ON inventory(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_stock ON inventory(stock_quantity);


-- ============================================
-- 14. REVIEWS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    menu_id INT REFERENCES menu(id),
    rating INT CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(255),
    review_text TEXT,
    is_verified BOOLEAN DEFAULT false,
    helpful_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reviews_order ON reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_customer ON reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_menu ON reviews(menu_id);


-- ============================================
-- SAMPLE DATA
-- ============================================

-- Insert Admin Users
INSERT INTO users (name, email, password, role, is_active) VALUES
('Admin User', 'admin@restaurantai.com', 'hashed_password_here', 'admin', true),
('Kitchen Manager', 'kitchen@restaurantai.com', 'hashed_password_here', 'kitchen_staff', true)
ON CONFLICT (email) DO NOTHING;

-- Insert Categories
INSERT INTO categories (name, description, display_order, is_active) VALUES
('Pizza', 'Fresh Italian pizzas with various toppings', 1, true),
('Burger', 'Juicy burgers with fresh ingredients', 2, true),
('Chinese', 'Authentic Chinese cuisine', 3, true),
('South Indian', 'Traditional South Indian dishes', 4, true),
('North Indian', 'Delicious North Indian specialties', 5, true),
('Drinks', 'Beverages and soft drinks', 6, true),
('Desserts', 'Sweet treats and desserts', 7, true)
ON CONFLICT (name) DO NOTHING;

-- Insert Menu Items
INSERT INTO menu (category_id, name, description, price, veg_type, is_available, is_featured, preparation_time) VALUES
(1, 'Paneer Tikka Pizza', 'Thin crust pizza with paneer tikka', 299.00, 'Veg', true, true, 20),
(1, 'Butter Chicken Pizza', 'Delicious butter chicken on pizza', 349.00, 'Non-Veg', true, false, 22),
(2, 'Butter Chicken Burger', 'Juicy burger with butter chicken', 199.00, 'Non-Veg', true, true, 15),
(2, 'Veg Burger', 'Fresh vegetable burger', 149.00, 'Veg', true, false, 12),
(3, 'Manchurian Noodles', 'Crispy noodles with manchurian sauce', 149.00, 'Veg', true, false, 15),
(3, 'Chow Mein', 'Stir-fried noodles with vegetables', 169.00, 'Veg', true, false, 16),
(4, 'Sambar Rice', 'Rice with authentic sambar', 89.00, 'Veg', true, false, 10),
(4, 'Biryani', 'Fragrant biryani rice', 220.00, 'Non-Veg', true, true, 25),
(5, 'Tandoori Chicken', 'Grilled tandoori chicken', 299.00, 'Non-Veg', true, true, 30),
(5, 'Butter Naan', 'Fresh naan bread with butter', 59.00, 'Veg', true, false, 8),
(6, 'Coke', 'Cold cola drink', 50.00, 'Veg', true, false, 1),
(6, 'Latte', 'Hot coffee latte', 120.00, 'Veg', true, false, 5),
(7, 'Choco Lava Cake', 'Chocolate lava cake with ice cream', 149.00, 'Veg', true, true, 10),
(7, 'Ice Cream', 'Vanilla ice cream', 99.00, 'Veg', true, false, 2)
ON CONFLICT DO NOTHING;

-- Insert Sample Customers
INSERT INTO customers (name, email, phone, address, city, state, postal_code, country) VALUES
('Rahul Kumar', 'rahul@email.com', '+91-9876543210', '123 MG Road', 'Bangalore', 'Karnataka', '560034', 'India'),
('Aman Singh', 'aman@email.com', '+91-9876543211', '456 Brigade Road', 'Bangalore', 'Karnataka', '560025', 'India'),
('Priya Sharma', 'priya@email.com', '+91-9876543212', '789 Indiranagar', 'Bangalore', 'Karnataka', '560038', 'India'),
('Neha Verma', 'neha@email.com', '+91-9876543213', '321 Koramangala', 'Bangalore', 'Karnataka', '560034', 'India'),
('Vikram Singh', 'vikram@email.com', '+91-9876543214', '654 Whitefield', 'Bangalore', 'Karnataka', '560066', 'India')
ON CONFLICT (email) DO NOTHING;

-- Insert Sample Coupons
INSERT INTO coupons (code, description, discount_type, discount_value, minimum_order_value, expiry_date, is_active) VALUES
('WELCOME10', '10% discount on first order', 'Percentage', 10.00, 100.00, '2026-12-31', true),
('FLAT100', 'Flat ₹100 discount', 'Flat', 100.00, 500.00, '2026-12-31', true),
('SUMMER20', '20% discount on summer specials', 'Percentage', 20.00, 300.00, '2026-12-31', true)
ON CONFLICT (code) DO NOTHING;
