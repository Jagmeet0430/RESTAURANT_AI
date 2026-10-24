-- Read-only reconciliation, no customer/order values in output.
SET TIME ZONE 'UTC';
SELECT 'menu' entity,count(*) records,md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),'')) digest FROM public.menu t
UNION ALL
SELECT 'categories',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),'')) FROM public.categories t
UNION ALL
SELECT 'orders',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),'')) FROM public.orders t
UNION ALL
SELECT 'order_items',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),'')) FROM public.order_items t
ORDER BY entity;
