-- CLOUD RECEIVER ONLY. Not part of the Windows migration sequence.
-- Execute inside one explicit transaction with its own cloud ledger entry.
-- Existing legacy tables are prerequisites, NOT evidence of applied migrations.
-- Fail closed on partial/previous local 018 schemas; never clear their outboxes.
SET LOCAL search_path = pg_catalog, public;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
SELECT pg_advisory_xact_lock(hashtext('restaurantai_cloud_menu_receiver'));
LOCK TABLE public.menu, public.categories IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE spec record; object_name text;
BEGIN
  IF to_regprocedure('pg_catalog.gen_random_uuid()') IS NULL THEN
    RAISE EXCEPTION 'Receiver requires built-in gen_random_uuid';
  END IF;
  FOR spec IN SELECT * FROM (VALUES
    ('menu','id','integer'), ('menu','category_id','integer'),
    ('menu','name','character varying'), ('menu','description','text'),
    ('menu','price','numeric'), ('menu','veg_type','character varying'),
    ('menu','image_url','text'), ('menu','barcode','character varying'),
    ('menu','is_available','boolean'), ('menu','is_featured','boolean'),
    ('menu','is_spicy','boolean'), ('menu','preparation_time','integer'),
    ('menu','calories','integer'), ('menu','updated_at','timestamp without time zone'),
    ('categories','id','integer'), ('categories','name','character varying'),
    ('categories','description','text'), ('categories','image_url','character varying'),
    ('categories','display_order','integer'), ('categories','is_active','boolean'),
    ('categories','updated_at','timestamp without time zone'),
    ('orders','id','integer'), ('orders','total_amount','numeric'),
    ('order_items','order_id','integer'), ('order_items','menu_id','integer'),
    ('schema_migrations','migration_name','character varying'),
    ('schema_migrations','checksum','character varying'), ('schema_migrations','baseline','boolean')
  ) AS required(table_name,column_name,data_type)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public'
      AND c.table_name=spec.table_name AND c.column_name=spec.column_name AND c.data_type=spec.data_type) THEN
      RAISE EXCEPTION 'Missing or incompatible prerequisite %.% (%)',spec.table_name,spec.column_name,spec.data_type;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name IN ('menu','categories') AND column_name IN ('sync_id','sync_version','sync_owner','deleted_at'))
    OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='menu'
      AND column_name IN ('visible_kiosk','visible_website','display_order','image_fallback_id')) THEN
    RAISE EXCEPTION 'Pre-existing sync columns require a separate reviewed adoption plan';
  END IF;
  FOREACH object_name IN ARRAY ARRAY['menu_sync_clock','menu_sync_outbox','menu_sync_receipts','menu_image_assets',
    'categories_sync_id_key','menu_sync_id_key','menu_sync_outbox_pending'] LOOP
    IF to_regclass('public.'||object_name) IS NOT NULL THEN
      RAISE EXCEPTION 'Pre-existing sync object % requires review',object_name;
    END IF;
  END LOOP;
  IF to_regprocedure('public.capture_menu_sync_change()') IS NOT NULL OR EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgrelid IN ('public.menu'::regclass,'public.categories'::regclass)
      AND tgname IN ('menu_sync_capture','category_sync_capture') AND NOT tgisinternal
  ) THEN RAISE EXCEPTION 'Local capture function/triggers must not be installed on a fresh receiver'; END IF;
  IF EXISTS (SELECT 1 FROM public.categories GROUP BY lower(trim(name)) HAVING count(*)>1)
    OR EXISTS (SELECT 1 FROM public.menu GROUP BY category_id,lower(trim(name)) HAVING count(*)>1)
    OR EXISTS (SELECT 1 FROM public.menu WHERE nullif(barcode,'') IS NOT NULL GROUP BY barcode HAVING count(*)>1) THEN
    RAISE EXCEPTION 'Ambiguous catalog identities require reconciliation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.menu m LEFT JOIN public.categories c ON c.id=m.category_id WHERE c.id IS NULL) THEN
    RAISE EXCEPTION 'Product category references require repair before receiver migration';
  END IF;
  FOREACH object_name IN ARRAY ARRAY['menu','categories','orders'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint p JOIN pg_attribute a
      ON a.attrelid=p.conrelid AND a.attname='id'
      WHERE p.conrelid=to_regclass('public.'||object_name) AND p.contype='p'
        AND p.conkey=ARRAY[a.attnum]::smallint[]) THEN
      RAISE EXCEPTION 'Expected single-column id primary key on %',object_name;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.menu WHERE name IS NULL OR trim(name)='' OR price IS NULL
    OR price<0 OR price>999999 OR veg_type IS NULL OR lower(veg_type) NOT IN ('veg','non-veg'))
    OR EXISTS (SELECT 1 FROM public.categories WHERE name IS NULL OR trim(name)='') THEN
    RAISE EXCEPTION 'Invalid catalog values require review before receiver migration';
  END IF;
END $$;

ALTER TABLE public.categories ADD COLUMN sync_id uuid NOT NULL DEFAULT pg_catalog.gen_random_uuid();
ALTER TABLE public.categories ADD COLUMN sync_version bigint NOT NULL DEFAULT 0;
ALTER TABLE public.categories ADD COLUMN sync_owner text;
ALTER TABLE public.categories ADD COLUMN deleted_at timestamptz;
ALTER TABLE public.menu ADD COLUMN sync_id uuid NOT NULL DEFAULT pg_catalog.gen_random_uuid();
ALTER TABLE public.menu ADD COLUMN sync_version bigint NOT NULL DEFAULT 0;
ALTER TABLE public.menu ADD COLUMN sync_owner text;
ALTER TABLE public.menu ADD COLUMN deleted_at timestamptz;
ALTER TABLE public.menu ADD COLUMN display_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.menu ADD COLUMN visible_kiosk boolean NOT NULL DEFAULT true;
ALTER TABLE public.menu ADD COLUMN visible_website boolean NOT NULL DEFAULT true;
ALTER TABLE public.menu ADD COLUMN image_fallback_id integer;
CREATE UNIQUE INDEX categories_sync_id_key ON public.categories(sync_id);
CREATE UNIQUE INDEX menu_sync_id_key ON public.menu(sync_id);
CREATE TABLE public.menu_sync_clock (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), version bigint NOT NULL DEFAULT 0
);
INSERT INTO public.menu_sync_clock(singleton) VALUES(true);
-- Empty compatibility table for the shared status reader. No capture triggers.
CREATE TABLE public.menu_sync_outbox (
  version bigint PRIMARY KEY, entity text NOT NULL CHECK(entity IN ('category','product')),
  sync_id uuid NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz, attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(), last_error_code text
);
CREATE INDEX menu_sync_outbox_pending ON public.menu_sync_outbox(version) WHERE delivered_at IS NULL;
CREATE TABLE public.menu_sync_receipts (
  source_id uuid NOT NULL, entity text NOT NULL, sync_id uuid NOT NULL, version bigint NOT NULL,
  PRIMARY KEY(source_id,entity,sync_id)
);
CREATE TABLE public.menu_image_assets (
  hash char(64) PRIMARY KEY, data bytea NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(octet_length(data)<=2097152)
);

-- Supabase's exposed public schema must not expose internal sync payloads/assets.
-- Do not change policies/grants on any existing business table.
DO $$
DECLARE object_name text; role_name text;
BEGIN
  FOREACH object_name IN ARRAY ARRAY['menu_sync_clock','menu_sync_outbox','menu_sync_receipts','menu_image_assets'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',object_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC',object_name);
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I',object_name,role_name);
      END IF;
    END LOOP;
  END LOOP;
END $$;
