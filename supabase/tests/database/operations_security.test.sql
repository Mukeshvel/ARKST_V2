begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();

select ok((select relrowsecurity from pg_class where oid=('public.'||name)::regclass),
  name||' enforces RLS') from unnest(array[
  'announcements','announcement_target_sections','announcement_recipients',
  'notifications','notification_outbox']) name;
select ok(not has_table_privilege('authenticated','public.'||name,'INSERT,UPDATE,DELETE'),
  name||' denies direct authenticated writes') from unnest(array[
  'announcements','announcement_target_sections','announcement_recipients',
  'notifications','notification_outbox']) name;
select ok(not has_table_privilege('anon','public.'||name,'SELECT'),
  name||' denies anonymous reads') from unnest(array[
  'announcements','announcement_target_sections','announcement_recipients',
  'notifications','notification_outbox']) name;
select ok(not has_table_privilege('authenticated','public.notification_outbox','SELECT'),
  'outbox is not an application read surface');
select ok(not has_table_privilege('authenticated','public.announcement_target_sections','SELECT'),
  'announcement audience metadata is private');
select ok(not has_function_privilege('anon','public.'||signature,'EXECUTE'),
  signature||' denies anonymous execution') from unnest(array[
  'eligible_activity_students(uuid,text,boolean,text,integer)',
  'create_selected_activity(text,uuid,uuid[],boolean,text,text,timestamptz,timestamptz,timestamptz,boolean)',
  'monitor_counselor_activity(uuid,integer)','counselor_activity_summaries(integer)',
  'pending_students_text(uuid,boolean)',
  'publish_announcement(uuid,text,uuid[],uuid[],text,text)',
  'mark_notification_read(uuid)']) signature;
select ok(p.prosecdef and 'search_path=""'=any(p.proconfig),
  p.proname||' is fixed-path SECURITY DEFINER')
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where (n.nspname='public' and p.proname in (
    'eligible_activity_students','create_selected_activity','monitor_counselor_activity',
    'counselor_activity_summaries','pending_students_text','publish_announcement',
    'mark_notification_read')) or (n.nspname='activity_private' and p.proname in (
    'targetable_students','counselor_activity_rows','enqueue_notification',
    'notify_activity_assignment','notify_announcement_recipient'));
select ok(not has_function_privilege('authenticated','activity_private.'||signature,'EXECUTE'),
  signature||' has no direct authenticated EXECUTE') from unnest(array[
  'targetable_students(uuid,text,boolean)','counselor_activity_rows(uuid)',
  'enqueue_notification()','notify_activity_assignment()',
  'notify_announcement_recipient()']) signature;
select ok(exists(select 1 from pg_trigger where tgname=name and not tgisinternal),
  name||' exists') from unnest(array[
  'notification_outbox_insert','activity_assignment_notification',
  'announcement_recipient_notification']) name;
select ok(exists(select 1 from pg_indexes where schemaname='public' and tablename='notifications'
  and indexdef like '%recipient_id, source_kind, source_id%'),
  'notification source/recipient uniqueness is indexed');

select * from finish();
rollback;
