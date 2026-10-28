begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();

select ok((select relrowsecurity from pg_class where oid=('public.'||name)::regclass),
  name||' enforces RLS') from unnest(array[
  'activity_follow_ups','activity_follow_up_history','catch_up_requests',
  'catch_up_history','escalation_routes','activity_escalations',
  'activity_escalation_history']) name;
select ok(not has_table_privilege('authenticated','public.'||name,'INSERT,UPDATE,DELETE'),
  name||' denies direct authenticated writes') from unnest(array[
  'activity_follow_ups','activity_follow_up_history','catch_up_requests',
  'catch_up_history','escalation_routes','activity_escalations',
  'activity_escalation_history']) name;
select ok(not has_table_privilege('anon','public.'||name,'SELECT'),
  name||' denies anonymous reads') from unnest(array[
  'activity_follow_ups','activity_follow_up_history','catch_up_requests',
  'catch_up_history','escalation_routes','activity_escalations',
  'activity_escalation_history']) name;
select ok(not has_table_privilege('authenticated','public.escalation_routes','SELECT'),
  'trusted escalation route configuration is not directly readable');
select ok(not has_function_privilege('anon','public.'||signature,'EXECUTE'),
  signature||' denies anonymous execution') from unnest(array[
  'send_activity_follow_ups(uuid[],text)','resolve_activity_follow_up(uuid,text)',
  'submit_catch_up_request(text,text)','review_catch_up_request(uuid,boolean,text)',
  'publish_catch_up_request(uuid,uuid,text,uuid[],uuid[],text,text)',
  'list_catch_up_requests(integer)','attention_needed(integer)',
  'missed_information_attention(integer)',
  'escalate_activity(uuid,text)','resolve_activity_escalation(uuid,text)',
  'list_activity_escalations(integer)']) signature;
select ok(p.prosecdef and 'search_path=""'=any(p.proconfig),
  p.proname||' is fixed-path SECURITY DEFINER')
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where (n.nspname='public' and p.proname in (
    'send_activity_follow_ups','resolve_activity_follow_up','submit_catch_up_request',
    'review_catch_up_request','publish_catch_up_request','list_catch_up_requests',
    'attention_needed','missed_information_attention','escalate_activity','resolve_activity_escalation','list_activity_escalations'))
    or (n.nspname='activity_private' and p.proname in (
    'can_follow_up_assignment','can_view_follow_up','resolve_follow_up_on_report',
    'can_review_catch_up','can_view_catch_up','validate_escalation_route',
    'current_escalation_recipient','can_view_escalation','resolve_escalation_on_report',
    'guard_escalation_route_responsibility','guard_escalation_route_scope'));
select ok(not has_function_privilege('authenticated','activity_private.'||signature,'EXECUTE'),
  signature||' has no direct authenticated EXECUTE') from unnest(array[
  'can_follow_up_assignment(uuid)','can_review_catch_up(uuid)',
  'current_escalation_recipient(uuid)']) signature;
select ok(has_function_privilege('authenticated','activity_private.'||signature,'EXECUTE'),
  signature||' is executable by the RLS querying role') from unnest(array[
  'can_view_follow_up(uuid)','can_view_catch_up(uuid)',
  'can_view_escalation(uuid)']) signature;
select ok(exists(select 1 from pg_trigger where tgname=name and not tgisinternal),
  name||' exists') from unnest(array[
  'activity_completion_resolve_follow_up','activity_completion_resolve_escalation',
  'escalation_route_validate','escalation_responsibility_guard','escalation_scope_guard']) name;
select ok(exists(select 1 from pg_indexes where schemaname='public'
  and indexname=name),name||' prevents concurrent duplicates') from unnest(array[
  'one_open_follow_up_per_assignment','one_pending_catch_up_subject',
  'one_current_escalation_route','one_open_escalation_per_assignment']) name;

select * from finish();
rollback;
