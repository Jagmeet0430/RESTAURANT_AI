-- Local-authoritative follow-up to immutable 018. Run through a transactional
-- ledger runner after backup. No bootstrap, data rewrite or trigger replacement.
DO $$
BEGIN
  IF to_regclass('public.menu_sync_outbox') IS NULL OR NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgrelid='public.menu'::regclass
      AND tgname='menu_sync_capture' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION '019 requires the local-authoritative 018 schema and capture trigger';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.capture_menu_sync_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE revision bigint; body jsonb; kind text;
BEGIN
  IF current_setting('restaurantai.menu_import', true) = 'on' THEN
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  UPDATE public.menu_sync_clock SET version=version+1 WHERE singleton RETURNING version INTO revision;
  kind := CASE WHEN TG_TABLE_NAME='menu' THEN 'product' ELSE 'category' END;
  IF TG_OP='DELETE' THEN
    body := to_jsonb(OLD) || jsonb_build_object('deleted_at',now(),'sync_version',revision);
  ELSE
    NEW.sync_version := revision;
    body := to_jsonb(NEW);
  END IF;
  IF kind='product' THEN
    body := body || jsonb_build_object('category_sync_id',(SELECT sync_id FROM public.categories WHERE id=(body->>'category_id')::int));
  END IF;
  INSERT INTO public.menu_sync_outbox(version,entity,sync_id,payload)
    VALUES(revision,kind,(body->>'sync_id')::uuid,body - 'created_by');
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
