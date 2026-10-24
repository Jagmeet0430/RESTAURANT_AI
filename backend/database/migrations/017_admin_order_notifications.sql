-- Existing orders remain ineligible; future local creations/imports opt in.
-- No order totals, statuses, or historical records are rewritten.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_notification_eligible BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE orders ALTER COLUMN admin_notification_eligible SET DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS admin_order_notifications (
  order_id BIGINT PRIMARY KEY,
  event_type VARCHAR(40) NOT NULL DEFAULT 'order_created' CHECK (event_type = 'order_created'),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by BIGINT
);
-- Retain acknowledgements permanently, even if an order is later removed.
-- No foreign key is added that would change existing order deletion behavior.
CREATE INDEX IF NOT EXISTS idx_admin_order_notifications_pending
  ON admin_order_notifications(created_at, order_id) WHERE acknowledged_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_admin_notification_eligible
  ON orders(id) WHERE admin_notification_eligible = TRUE;
