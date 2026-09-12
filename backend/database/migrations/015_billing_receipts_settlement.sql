CREATE SEQUENCE IF NOT EXISTS bill_number_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS pos_bill_number_seq START WITH 1;

ALTER TABLE IF EXISTS bills
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(30) NOT NULL DEFAULT 'order',
  ADD COLUMN IF NOT EXISTS source_id INTEGER,
  ADD COLUMN IF NOT EXISTS order_number VARCHAR(80),
  ADD COLUMN IF NOT EXISTS token_number INTEGER,
  ADD COLUMN IF NOT EXISTS table_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS order_type VARCHAR(30),
  ADD COLUMN IF NOT EXISTS order_source VARCHAR(40),
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS paid_by INTEGER,
  ADD COLUMN IF NOT EXISTS settled_by INTEGER,
  ADD COLUMN IF NOT EXISTS receipt_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE bills b
SET source_type = 'order',
    source_id = b.order_id,
    order_number = COALESCE(b.order_number, o.order_number),
    token_number = COALESCE(b.token_number, o.token_number),
    table_number = COALESCE(b.table_number, o.table_number),
    order_type = COALESCE(b.order_type, o.order_type),
    order_source = COALESCE(b.order_source, o.order_source),
    paid_at = COALESCE(b.paid_at, o.paid_at)
FROM orders o
WHERE b.order_id = o.id;

CREATE INDEX IF NOT EXISTS idx_bills_source ON bills(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_bills_payment_status ON bills(payment_status);

ALTER TABLE IF EXISTS payments
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(30) NOT NULL DEFAULT 'order',
  ADD COLUMN IF NOT EXISTS source_id BIGINT;

UPDATE payments
SET source_type = 'order',
    source_id = order_id
WHERE source_id IS NULL
  AND order_id IS NOT NULL;

ALTER TABLE IF EXISTS payments
  ALTER COLUMN order_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_source ON payments(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_payments_status_method ON payments(payment_status, payment_method);

CREATE TABLE IF NOT EXISTS billing_audit_events (
  id BIGSERIAL PRIMARY KEY,
  bill_id INTEGER,
  source_type VARCHAR(30),
  source_id BIGINT,
  action VARCHAR(80) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_billing_audit_events_bill ON billing_audit_events(bill_id);
CREATE INDEX IF NOT EXISTS idx_billing_audit_events_action ON billing_audit_events(action, created_at);

CREATE TABLE IF NOT EXISTS end_of_day_settlements (
  id BIGSERIAL PRIMARY KEY,
  business_date DATE NOT NULL UNIQUE,
  opened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cash_collected NUMERIC(12, 2) NOT NULL DEFAULT 0,
  upi_collected NUMERIC(12, 2) NOT NULL DEFAULT 0,
  card_collected NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
  unpaid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  refunds NUMERIC(12, 2) NOT NULL DEFAULT 0,
  pos_revenue NUMERIC(12, 2) NOT NULL DEFAULT 0,
  restaurant_order_revenue NUMERIC(12, 2) NOT NULL DEFAULT 0,
  combined_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  expected_cash NUMERIC(12, 2) NOT NULL DEFAULT 0,
  actual_cash NUMERIC(12, 2) NOT NULL DEFAULT 0,
  cash_difference NUMERIC(12, 2) NOT NULL DEFAULT 0,
  summary_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  closed_by INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_end_of_day_settlements_closed_at
  ON end_of_day_settlements(closed_at DESC);
