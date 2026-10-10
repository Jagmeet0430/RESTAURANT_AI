-- Apply to cloud and local databases after migrations 014 and 015.
-- Existing order_source, order_items, tracking and status history are reused.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cloud_order_id BIGINT,
  ADD COLUMN IF NOT EXISTS cloud_sync_origin TEXT,
  ADD COLUMN IF NOT EXISTS cloud_local_order_id BIGINT,
  ADD COLUMN IF NOT EXISTS cloud_sync_status VARCHAR(20),
  ADD COLUMN IF NOT EXISTS cloud_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cloud_sync_version BIGINT NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_cloud_order_unique
  ON orders(cloud_order_id) WHERE cloud_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_cloud_pending
  ON orders(id) WHERE cloud_synced_at IS NULL AND cloud_order_id IS NULL
    AND order_source IN ('website', 'customer_web');

-- This is a delivery queue, not a second order store. Each local mutation and
-- its immutable event commit together, even when the network/worker is down.
CREATE TABLE IF NOT EXISTS cloud_order_sync_events (
  id BIGSERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  version BIGINT NOT NULL,
  payload JSONB NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_error_code VARCHAR(80),
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(order_id, version)
);
CREATE INDEX IF NOT EXISTS idx_cloud_order_events_pending
  ON cloud_order_sync_events(next_attempt_at, id) WHERE delivered_at IS NULL;

CREATE OR REPLACE FUNCTION queue_cloud_order_change() RETURNS trigger AS $$
BEGIN
  IF NEW.cloud_order_id IS NOT NULL AND
     ROW(NEW.status, NEW.payment_status, NEW.payment_method, NEW.paid_at,
         NEW.cancellation_reason, NEW.estimated_ready_at, NEW.actual_delivery_time)
     IS DISTINCT FROM
     ROW(OLD.status, OLD.payment_status, OLD.payment_method, OLD.paid_at,
         OLD.cancellation_reason, OLD.estimated_ready_at, OLD.actual_delivery_time) THEN
    NEW.cloud_sync_version := OLD.cloud_sync_version + 1;
    NEW.cloud_sync_status := 'pending';
    INSERT INTO cloud_order_sync_events(order_id, version, payload)
    VALUES (NEW.id, NEW.cloud_sync_version, jsonb_build_object(
      'local_order_id', NEW.id, 'version', NEW.cloud_sync_version,
      'status', NEW.status, 'payment_status', NEW.payment_status,
      'payment_method', NEW.payment_method,
      'paid_at', NEW.paid_at AT TIME ZONE current_setting('TimeZone'),
      'cancellation_reason', NEW.cancellation_reason,
      'estimated_ready_at', NEW.estimated_ready_at AT TIME ZONE current_setting('TimeZone'),
      'actual_delivery_time', NEW.actual_delivery_time AT TIME ZONE current_setting('TimeZone')
    ));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_queue_cloud_order_change ON orders;
CREATE TRIGGER trg_queue_cloud_order_change
  BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION queue_cloud_order_change();
