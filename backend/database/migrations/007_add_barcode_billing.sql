ALTER TABLE menu
ADD COLUMN IF NOT EXISTS barcode VARCHAR(100);

CREATE UNIQUE INDEX IF NOT EXISTS idx_menu_barcode_unique
ON menu(barcode)
WHERE barcode IS NOT NULL AND barcode <> '';

ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS menu_id INTEGER,
ADD COLUMN IF NOT EXISTS barcode VARCHAR(100),
ADD COLUMN IF NOT EXISTS stock_per_sale NUMERIC(12, 2) NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_inventory_menu
ON inventory(menu_id);

CREATE INDEX IF NOT EXISTS idx_inventory_barcode
ON inventory(barcode);

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
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bills_order
ON bills(order_id);

CREATE INDEX IF NOT EXISTS idx_bills_created_at
ON bills(created_at);
