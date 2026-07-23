CREATE TABLE IF NOT EXISTS payments (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    customer_id BIGINT,
    gateway VARCHAR(30) NOT NULL DEFAULT 'razorpay',
    payment_method VARCHAR(30) NOT NULL,
    gateway_order_id VARCHAR(100),
    gateway_payment_id VARCHAR(100),
    gateway_signature TEXT,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    payment_status VARCHAR(30) NOT NULL DEFAULT 'pending',
    failure_reason TEXT,
    transaction_id VARCHAR(100),
    paid_at TIMESTAMP,
    refunded_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS customer_id BIGINT;

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS gateway VARCHAR(30) NOT NULL DEFAULT 'razorpay';

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS gateway_order_id VARCHAR(100);

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS gateway_payment_id VARCHAR(100);

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS gateway_signature TEXT;

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'INR';

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS failure_reason TEXT;

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP;

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS unique_gateway_payment
ON payments(gateway_payment_id)
WHERE gateway_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_order_id
ON payments(order_id);

CREATE INDEX IF NOT EXISTS idx_payments_status
ON payments(payment_status);

CREATE INDEX IF NOT EXISTS idx_payments_gateway_order
ON payments(gateway_order_id);

CREATE TABLE IF NOT EXISTS payment_webhook_events (
    event_id VARCHAR(100) PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    gateway VARCHAR(30) NOT NULL DEFAULT 'razorpay',
    processed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50)
DEFAULT 'Cash';

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50)
DEFAULT 'Pending';

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(100);

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;
