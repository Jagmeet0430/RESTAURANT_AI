import { pool } from "../config/database.js";

export async function ensureOrderSecuritySchema(client = pool) {
  await client.query(`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(30),
      ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS order_type VARCHAR(30) NOT NULL DEFAULT 'pickup',
      ADD COLUMN IF NOT EXISTS tracking_token VARCHAR(96),
      ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
      ADD COLUMN IF NOT EXISTS estimated_ready_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS ip_address VARCHAR(80),
      ADD COLUMN IF NOT EXISTS user_agent TEXT,
      ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(120)
  `);

  await client.query(`
    UPDATE orders o
    SET
      customer_name = COALESCE(o.customer_name, c.name),
      customer_phone = COALESCE(o.customer_phone, c.phone)
    FROM customers c
    WHERE c.id = o.customer_id
  `);

  await client.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number_unique ON orders(order_number)");
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_tracking_token_unique
    ON orders(tracking_token)
    WHERE tracking_token IS NOT NULL
  `);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key_unique
    ON orders(idempotency_key)
    WHERE idempotency_key IS NOT NULL AND idempotency_key <> ''
  `);
  await client.query("CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC)");

  await client.query(`
    CREATE TABLE IF NOT EXISTS order_status_history (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      previous_status VARCHAR(40),
      new_status VARCHAR(40) NOT NULL,
      changed_by INTEGER,
      cancellation_reason TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_order_status_history_order
    ON order_status_history(order_id, created_at DESC)
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_notifications (
      id SERIAL PRIMARY KEY,
      order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
      phone_number VARCHAR(20) NOT NULL,
      notification_type VARCHAR(80) NOT NULL,
      order_status VARCHAR(40),
      provider VARCHAR(30) NOT NULL,
      provider_message_id VARCHAR(180),
      delivery_status VARCHAR(40) NOT NULL DEFAULT 'queued',
      error_message TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      sent_at TIMESTAMP,
      delivered_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_notifications_order_status_once
    ON whatsapp_notifications(order_id, order_status, notification_type)
    WHERE order_id IS NOT NULL AND order_status IS NOT NULL
  `);
}
