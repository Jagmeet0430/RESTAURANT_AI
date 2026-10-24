-- Additive catalog metadata. Business IDs and historical sale amounts are unchanged.
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sync_id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sync_version bigint NOT NULL DEFAULT 0;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sync_owner text;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE menu ADD COLUMN IF NOT EXISTS sync_id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE menu ADD COLUMN IF NOT EXISTS sync_version bigint NOT NULL DEFAULT 0;
ALTER TABLE menu ADD COLUMN IF NOT EXISTS sync_owner text;
ALTER TABLE menu ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE menu ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;
ALTER TABLE menu ADD COLUMN IF NOT EXISTS visible_kiosk boolean NOT NULL DEFAULT true;
ALTER TABLE menu ADD COLUMN IF NOT EXISTS visible_website boolean NOT NULL DEFAULT true;
-- Only for the bundled photo catalog; never used as a product/order identity.
ALTER TABLE menu ADD COLUMN IF NOT EXISTS image_fallback_id integer;
CREATE UNIQUE INDEX IF NOT EXISTS categories_sync_id_key ON categories(sync_id);
CREATE UNIQUE INDEX IF NOT EXISTS menu_sync_id_key ON menu(sync_id);

CREATE TABLE IF NOT EXISTS menu_sync_clock (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  version bigint NOT NULL DEFAULT 0
);
INSERT INTO menu_sync_clock(singleton) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS menu_sync_outbox (
  version bigint PRIMARY KEY,
  entity text NOT NULL CHECK(entity IN ('category','product')),
  sync_id uuid NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error_code text
);
CREATE INDEX IF NOT EXISTS menu_sync_outbox_pending ON menu_sync_outbox(version) WHERE delivered_at IS NULL;
CREATE TABLE IF NOT EXISTS menu_sync_receipts (
  source_id uuid NOT NULL,
  entity text NOT NULL,
  sync_id uuid NOT NULL,
  version bigint NOT NULL,
  PRIMARY KEY(source_id,entity,sync_id)
);
CREATE TABLE IF NOT EXISTS menu_image_assets (
  hash char(64) PRIMARY KEY,
  data bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(octet_length(data) <= 2097152)
);

CREATE OR REPLACE FUNCTION capture_menu_sync_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE revision bigint; body jsonb; kind text;
BEGIN
  IF current_setting('restaurantai.menu_import', true) = 'on' THEN
    RETURN NEW;
  END IF;
  -- Serializes revisions until commit: a later poll cannot miss a slow earlier transaction.
  UPDATE menu_sync_clock SET version=version+1 WHERE singleton RETURNING version INTO revision;
  kind := CASE WHEN TG_TABLE_NAME='menu' THEN 'product' ELSE 'category' END;
  IF TG_OP='DELETE' THEN
    body := to_jsonb(OLD) || jsonb_build_object('deleted_at',now(),'sync_version',revision);
  ELSE
    NEW.sync_version := revision;
    body := to_jsonb(NEW);
  END IF;
  IF kind='product' THEN
    body := body || jsonb_build_object('category_sync_id',(SELECT sync_id FROM categories WHERE id=(body->>'category_id')::int));
  END IF;
  INSERT INTO menu_sync_outbox(version,entity,sync_id,payload)
    VALUES(revision,kind,(body->>'sync_id')::uuid,body - 'created_by');
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER menu_sync_capture BEFORE INSERT OR UPDATE OR DELETE ON menu
  FOR EACH ROW EXECUTE FUNCTION capture_menu_sync_change();
CREATE OR REPLACE TRIGGER category_sync_capture BEFORE INSERT OR UPDATE OR DELETE ON categories
  FOR EACH ROW EXECUTE FUNCTION capture_menu_sync_change();
-- Queue the initial catalog exactly once, parents before products. Reruns are inert.
UPDATE categories SET sync_version=sync_version WHERE sync_version=0;
UPDATE menu SET sync_version=sync_version WHERE sync_version=0;
