CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    barcode VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(100),
    brand VARCHAR(120),
    description TEXT,
    unit VARCHAR(30) NOT NULL DEFAULT 'piece',
    purchase_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    quantity NUMERIC(12, 2) NOT NULL DEFAULT 0,
    minimum_stock NUMERIC(12, 2) NOT NULL DEFAULT 5,
    supplier_id INTEGER,
    supplier_name VARCHAR(150),
    image_url VARCHAR(500),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS brand VARCHAR(120),
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS image_url VARCHAR(500),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS inventory_transactions (
    id SERIAL PRIMARY KEY,
    inventory_id INTEGER REFERENCES inventory(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    transaction_type VARCHAR(30) NOT NULL,
    quantity NUMERIC(12, 2) NOT NULL,
    quantity_before NUMERIC(12, 2) NOT NULL DEFAULT 0,
    quantity_after NUMERIC(12, 2) NOT NULL DEFAULT 0,
    reference_type VARCHAR(50),
    reference_id INTEGER,
    reference_number VARCHAR(100),
    notes TEXT,
    created_by INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE inventory_transactions
    ADD COLUMN IF NOT EXISTS inventory_id INTEGER REFERENCES inventory(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS quantity_before NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS quantity_after NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS reference_id INTEGER,
    ADD COLUMN IF NOT EXISTS reference_number VARCHAR(100),
    ADD COLUMN IF NOT EXISTS created_by INTEGER,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE inventory_transactions
    ALTER COLUMN inventory_id DROP NOT NULL,
    ALTER COLUMN quantity_before SET DEFAULT 0,
    ALTER COLUMN quantity_after SET DEFAULT 0;

UPDATE inventory_transactions
SET
    quantity_before = COALESCE(quantity_before, 0),
    quantity_after = COALESCE(quantity_after, 0)
WHERE quantity_before IS NULL
   OR quantity_after IS NULL;

ALTER TABLE inventory_transactions
    ALTER COLUMN quantity_before SET NOT NULL,
    ALTER COLUMN quantity_after SET NOT NULL;

DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    FOR constraint_name IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE rel.relname = 'inventory_transactions'
          AND nsp.nspname = current_schema()
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) ILIKE '%transaction_type%'
    LOOP
        EXECUTE format('ALTER TABLE inventory_transactions DROP CONSTRAINT IF EXISTS %I', constraint_name);
    END LOOP;
END $$;

ALTER TABLE inventory_transactions
    ADD CONSTRAINT inventory_transactions_transaction_type_check
    CHECK (
        transaction_type IN (
            'STOCK_IN',
            'STOCK_OUT',
            'SALE',
            'RETURN',
            'ADJUSTMENT',
            'WASTE',
            'WASTAGE'
        )
    );

CREATE INDEX IF NOT EXISTS idx_products_barcode
ON products(barcode);

CREATE INDEX IF NOT EXISTS idx_transactions_product
ON inventory_transactions(product_id);
