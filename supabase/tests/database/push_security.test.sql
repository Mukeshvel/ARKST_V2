begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();

select ok((select relrowsecurity from pg_class where oid=('public.'||name)::regclass),
  name||' enforces RLS') from unnest(array['push_subscriptions','push_deliveries']) name;
select ok(not has_table_privilege('authenticated','public.'||name,'SELECT,INSERT,UPDATE,DELETE'),
  name||' denies direct authenticated access') from unnest(array['push_subscriptions','push_deliveries']) name;
select ok(not has_table_privilege('anon','public.'||name,'SELECT,INSERT,UPDATE,DELETE'),
  name||' denies anonymous access') from unnest(array['push_subscriptions','push_deliveries']) name;
select ok(not has_table_privilege('authenticated','public.notification_outbox','UPDATE'),
  'authenticated users cannot claim outbox jobs');
select ok(not has_function_privilege('anon','public.'||signature,'EXECUTE'),
  signature||' denies anonymous execution') from unnest(array[
    'register_push_subscription(text,text,text,timestamptz)',
    'push_subscription_status(text)','disable_push_subscription(text)',
    'mark_notification_unread(uuid)']) signature;
select ok(p.prosecdef and 'search_path=""'=any(p.proconfig),
  p.proname||' is fixed-path SECURITY DEFINER')
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in
    ('register_push_subscription','push_subscription_status','disable_push_subscription',
      'mark_notification_unread');
select ok(exists(select 1 from pg_indexes where schemaname='public' and tablename='push_subscriptions'
  and indexdef like '%UNIQUE%' and indexdef like '%endpoint%'),
  'one endpoint cannot belong to two accounts');
select ok(exists(select 1 from pg_indexes where schemaname='public' and tablename='push_deliveries'
  and indexdef like '%UNIQUE%' and indexdef like '%outbox_id, subscription_id%'),
  'one delivery row per outbox event and device');
select ok(exists(select 1 from pg_indexes where schemaname='public' and tablename='notification_outbox'
  and indexname='notification_outbox_due_idx'),
  'pending outbox claim has a due index');

select * from finish();
rollback;
