CREATE TABLE IF NOT EXISTS suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    contact_person VARCHAR(120),
    phone VARCHAR(20),
    email VARCHAR(150),
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE suppliers
    ADD COLUMN IF NOT EXISTS contact_person VARCHAR(120),
    ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
    ADD COLUMN IF NOT EXISTS email VARCHAR(150),
    ADD COLUMN IF NOT EXISTS address TEXT,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS inventory (
    id SERIAL PRIMARY KEY,
    ingredient_name VARCHAR(150) NOT NULL,
    quantity NUMERIC(12, 2) NOT NULL DEFAULT 0,
    unit VARCHAR(30) NOT NULL,
    minimum_level NUMERIC(12, 2) NOT NULL DEFAULT 0,
    cost_per_unit NUMERIC(12, 2) DEFAULT 0,
    expiry_date DATE,
    supplier_id INTEGER REFERENCES suppliers(id)
        ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
    id SERIAL PRIMARY KEY,
    inventory_id INTEGER NOT NULL REFERENCES inventory(id)
        ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL
        CHECK (transaction_type IN ('STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT', 'WASTE')),
    quantity NUMERIC(12, 2) NOT NULL,
    reference_type VARCHAR(50),
    reference_id INTEGER,
    notes TEXT,
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_supplier
ON inventory(supplier_id);

CREATE INDEX IF NOT EXISTS idx_inventory_expiry
ON inventory(expiry_date);

INSERT INTO suppliers
(name, contact_person, phone, email, address)
SELECT 'Fresh Farm Foods', 'Rajesh Kumar', '9876543210',
       'freshfarm@example.com', 'Delhi'
WHERE NOT EXISTS (
    SELECT 1 FROM suppliers WHERE email = 'freshfarm@example.com'
);

INSERT INTO suppliers
(name, contact_person, phone, email, address)
SELECT 'Daily Dairy Supplier', 'Amit Sharma', '9876501234',
       'dairy@example.com', 'Noida'
WHERE NOT EXISTS (
    SELECT 1 FROM suppliers WHERE email = 'dairy@example.com'
);

INSERT INTO suppliers
(name, contact_person, phone, email, address)
SELECT 'Spice Market India', 'Rohit Verma', '9812345678',
       'spices@example.com', 'Delhi'
WHERE NOT EXISTS (
    SELECT 1 FROM suppliers WHERE email = 'spices@example.com'
);
