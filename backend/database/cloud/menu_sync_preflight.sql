-- Read-only inventory. Run separately; export results for review, not to Git.
BEGIN READ ONLY;
SELECT current_database(),current_user,version(),current_setting('search_path');
SELECT count(*) AS products FROM public.menu;
SELECT count(*) AS categories FROM public.categories;
SELECT count(*) AS orders FROM public.orders;
SELECT * FROM public.schema_migrations ORDER BY migration_name;
SELECT table_name,column_name,data_type,udt_name,is_nullable,column_default,character_maximum_length,numeric_precision,numeric_scale
FROM information_schema.columns WHERE table_schema='public' AND table_name IN
 ('menu','categories','orders','order_items','schema_migrations','menu_sync_clock','menu_sync_outbox','menu_sync_receipts','menu_image_assets')
ORDER BY table_name,ordinal_position;
SELECT c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) owner,c.relacl
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p');
SELECT conrelid::regclass AS relation,conname,pg_get_constraintdef(oid) definition FROM pg_constraint
WHERE conrelid IN ('public.menu'::regclass,'public.categories'::regclass,'public.orders'::regclass,'public.order_items'::regclass);
SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public';
SELECT tgrelid::regclass AS relation,tgname,pg_get_triggerdef(oid) definition FROM pg_trigger
WHERE NOT tgisinternal AND tgrelid IN ('public.menu'::regclass,'public.categories'::regclass);
SELECT * FROM pg_policies WHERE schemaname='public';
SELECT rolname,rolsuper,rolbypassrls FROM pg_roles WHERE rolname IN (current_user,'anon','authenticated','service_role');
SELECT lower(trim(name)) normalized_name,count(*) FROM public.categories GROUP BY 1 HAVING count(*)>1;
SELECT category_id,lower(trim(name)) normalized_name,count(*) FROM public.menu GROUP BY 1,2 HAVING count(*)>1;
SELECT barcode,count(*) FROM public.menu WHERE nullif(barcode,'') IS NOT NULL GROUP BY 1 HAVING count(*)>1;
-- JSON access also works when sync columns do not yet exist.
SELECT 'menu' entity,to_jsonb(m)->>'sync_id' sync_id,count(*) FROM public.menu m
WHERE to_jsonb(m)->>'sync_id' IS NOT NULL GROUP BY 2 HAVING count(*)>1
UNION ALL
SELECT 'category',to_jsonb(c)->>'sync_id',count(*) FROM public.categories c
WHERE to_jsonb(c)->>'sync_id' IS NOT NULL GROUP BY 2 HAVING count(*)>1;
SELECT m.id FROM public.menu m LEFT JOIN public.categories c ON c.id=m.category_id WHERE c.id IS NULL;
-- Catalog-only comparison; do not export customer/order personal data to chat.
SELECT to_jsonb(m) - 'created_by' AS product,c.name category_name FROM public.menu m
JOIN public.categories c ON c.id=m.category_id ORDER BY m.id;
SELECT to_jsonb(c) - 'created_by' AS category FROM public.categories c ORDER BY c.id;
COMMIT;
