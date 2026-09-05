ALTER TABLE counter_sales
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(120);

CREATE UNIQUE INDEX IF NOT EXISTS idx_counter_sales_idempotency_key_unique
  ON counter_sales(idempotency_key)
  WHERE idempotency_key IS NOT NULL AND idempotency_key <> '';
