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
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE coupons ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS discount_type VARCHAR(50) NOT NULL DEFAULT 'Percentage';
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS discount_value DECIMAL(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS minimum_order_value DECIMAL(10, 2);
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS maximum_discount_value DECIMAL(10, 2);
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS usage_limit INT;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS used_count INT DEFAULT 0;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS usage_per_customer INT DEFAULT 1;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS start_date TIMESTAMP;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 year');
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active);
CREATE INDEX IF NOT EXISTS idx_coupons_expiry ON coupons(expiry_date);
