-- Phase 9: table QR ordering support.
-- Additive and safe for existing offline/local databases.

CREATE TABLE IF NOT EXISTS restaurant_tables (
    id SERIAL PRIMARY KEY,
    table_number VARCHAR(20) UNIQUE NOT NULL,
    display_name VARCHAR(80),
    qr_token VARCHAR(40),
    is_active BOOLEAN DEFAULT true,
    capacity INT DEFAULT 4,
    status VARCHAR(50) DEFAULT 'available',
    location VARCHAR(100),
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE restaurant_tables
    ADD COLUMN IF NOT EXISTS display_name VARCHAR(80),
    ADD COLUMN IF NOT EXISTS qr_token VARCHAR(40),
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS capacity INT DEFAULT 4,
    ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'available',
    ADD COLUMN IF NOT EXISTS location VARCHAR(100),
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

UPDATE restaurant_tables
SET display_name = 'Table ' || table_number
WHERE display_name IS NULL OR TRIM(display_name) = '';

UPDATE restaurant_tables
SET is_active = CASE
    WHEN LOWER(COALESCE(status, 'available')) IN ('inactive', 'disabled') THEN false
    ELSE true
END
WHERE is_active IS NULL;

UPDATE restaurant_tables
SET qr_token = 'TBL-' || UPPER(SUBSTRING(MD5(id::text || table_number || created_at::text), 1, 8))
WHERE qr_token IS NULL OR TRIM(qr_token) = '';

ALTER TABLE restaurant_tables
    ALTER COLUMN display_name SET NOT NULL,
    ALTER COLUMN qr_token SET NOT NULL,
    ALTER COLUMN is_active SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurant_tables_table_number_unique
    ON restaurant_tables(table_number);

CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurant_tables_qr_token_unique
    ON restaurant_tables(qr_token);

CREATE INDEX IF NOT EXISTS idx_restaurant_tables_is_active
    ON restaurant_tables(is_active);

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS table_id INT,
    ADD COLUMN IF NOT EXISTS table_number VARCHAR(20),
    ADD COLUMN IF NOT EXISTS order_source VARCHAR(30) DEFAULT 'customer_web',
    ADD COLUMN IF NOT EXISTS token_number INT,
    ADD COLUMN IF NOT EXISTS token_date DATE;

UPDATE orders
SET order_source = 'customer_web'
WHERE order_source IS NULL OR TRIM(order_source) = '';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'orders_table_id_fkey'
    ) THEN
        ALTER TABLE orders
            ADD CONSTRAINT orders_table_id_fkey
            FOREIGN KEY (table_id)
            REFERENCES restaurant_tables(id)
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_table_id
    ON orders(table_id);

CREATE INDEX IF NOT EXISTS idx_orders_table_number
    ON orders(table_number);

CREATE INDEX IF NOT EXISTS idx_orders_order_source
    ON orders(order_source);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_token_daily_unique
    ON orders(token_date, token_number)
    WHERE token_date IS NOT NULL AND token_number IS NOT NULL;
