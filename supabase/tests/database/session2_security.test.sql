begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();

select ok(not has_function_privilege('anon','public.supervisory_activity_overview(uuid,uuid,uuid,integer)','EXECUTE'),
  'selected Activity supervision denies anonymous execution');
select ok(has_function_privilege('authenticated','public.supervisory_activity_overview(uuid,uuid,uuid,integer)','EXECUTE'),
  'selected Activity supervision is available to authenticated callers with internal capability checks');
select ok((select prosecdef and 'search_path=""'=any(proconfig) from pg_proc
  where oid='public.supervisory_activity_overview(uuid,uuid,uuid,integer)'::regprocedure),
  'selected Activity supervision is fixed-path SECURITY DEFINER');

select ok((select relrowsecurity from pg_class where oid=('public.'||name)::regclass),
  name||' enforces RLS') from unnest(array[
  'department_operation_capabilities','academic_groups','group_membership_history',
  'activity_target_groups','announcement_target_groups','academic_group_changes',
  'recurring_schedules','recurring_schedule_sections','recurring_schedule_slots',
  'academic_blackouts','recurring_instances','activity_window_changes',
  'department_operation_grant_history']) name;
select ok(not has_table_privilege('authenticated','public.'||name,'INSERT,UPDATE,DELETE'),
  name||' denies direct authenticated writes') from unnest(array[
  'department_operation_capabilities','academic_groups','group_membership_history',
  'activity_target_groups','announcement_target_groups','academic_group_changes',
  'recurring_schedules','recurring_schedule_sections','recurring_schedule_slots',
  'academic_blackouts','recurring_instances','activity_window_changes',
  'department_operation_grant_history']) name;
select ok(not has_table_privilege('authenticated','public.'||name,'SELECT'),
  name||' denies direct authenticated read') from unnest(array[
  'department_operation_capabilities','academic_groups','group_membership_history',
  'activity_target_groups','announcement_target_groups','academic_group_changes',
  'recurring_schedules','recurring_schedule_sections','recurring_schedule_slots',
  'academic_blackouts','recurring_instances','activity_window_changes',
  'department_operation_grant_history']) name;
select ok(not has_table_privilege('anon','public.'||name,'SELECT'),
  name||' denies anonymous read') from unnest(array[
  'department_operation_capabilities','academic_groups','group_membership_history',
  'activity_target_groups','announcement_target_groups','academic_group_changes',
  'recurring_schedules','recurring_schedule_sections','recurring_schedule_slots',
  'academic_blackouts','recurring_instances','activity_window_changes',
  'department_operation_grant_history']) name;

select ok(not has_function_privilege('anon','public.'||signature,'EXECUTE'),
  signature||' denies anonymous execution') from unnest(array[
  'department_operation_options()','create_academic_group(uuid,text,text)',
  'list_academic_groups(uuid)','group_eligible_students(uuid,text,integer)',
  'current_group_members(uuid,integer)',
  'change_group_membership(uuid,uuid,boolean)','group_membership_history(uuid,integer)',
  'publish_group_activity(uuid,text,text,text,timestamptz,timestamptz,timestamptz,boolean)',
  'publish_group_announcement(uuid,text,text)','update_academic_group(uuid,text,text,boolean)',
  'create_recurring_schedule(uuid,text,text,text,date,integer,uuid[])',
  'configure_recurring_schedule(uuid,text,text,uuid[])','set_recurring_schedule_paused(uuid,boolean)',
  'configure_recurring_slot(uuid,integer,integer,integer,integer,time,time,text,text,boolean,boolean)',
  'create_academic_blackout(uuid,text,timestamptz,timestamptz)',
  'set_academic_blackout_active(uuid,boolean)','run_due_recurring_schedule(uuid,date)',
  'decide_blocked_recurring_instance(uuid,text)','calendar_overview(uuid)',
  'calendar_available_sections(uuid)','calendar_instance_history(uuid,integer)',
  'change_activity_window(uuid,timestamptz,timestamptz)',
  'supervisory_overview(uuid,uuid,integer)',
  'supervisory_student_detail(uuid,uuid,integer)']) signature;
select ok(not has_function_privilege('authenticated','public.run_due_recurring_schedule_locked_body(uuid,date)','EXECUTE'),
  'calendar runner body cannot bypass the department lock');
select ok(not has_function_privilege('authenticated','activity_private.'||signature,'EXECUTE'),
  signature||' denies direct authenticated execution') from unnest(array[
  'can_department_operation(uuid,text)','validate_academic_group()','guard_group_scope()',
  'validate_group_membership()','validate_recurring_relationships()',
  'lock_blackout_department()','serialize_counselor_mutations()',
  'activity_in_department(uuid,uuid)']) signature;
select ok(p.prosecdef and 'search_path=""'=any(p.proconfig),
  p.proname||' remains fixed-path SECURITY DEFINER')
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='activity_private' and p.proname in (
  'can_department_operation','validate_academic_group','guard_group_scope',
  'validate_group_membership','validate_recurring_relationships','lock_blackout_department',
  'serialize_counselor_mutations','activity_in_department'))
or (n.nspname='public' and p.proname in (
  'department_operation_options','create_academic_group','list_academic_groups',
  'group_eligible_students','current_group_members','change_group_membership','group_membership_history',
  'publish_group_activity','publish_group_announcement','update_academic_group',
  'create_recurring_schedule','configure_recurring_schedule','set_recurring_schedule_paused',
  'configure_recurring_slot','create_academic_blackout','set_academic_blackout_active',
  'run_due_recurring_schedule','run_due_recurring_schedule_locked_body',
  'decide_blocked_recurring_instance','calendar_overview','calendar_available_sections',
  'change_activity_window','supervisory_overview','supervisory_student_detail','calendar_instance_history'));
select is((select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where p.prosecdef and 'search_path=""'=any(p.proconfig)
    and ((n.nspname='activity_private' and p.proname in (
      'can_department_operation','validate_academic_group','guard_group_scope',
      'validate_group_membership','validate_recurring_relationships','lock_blackout_department',
      'serialize_counselor_mutations','activity_in_department'))
    or (n.nspname='public' and p.proname in (
      'department_operation_options','create_academic_group','list_academic_groups',
      'group_eligible_students','current_group_members','change_group_membership','group_membership_history',
      'publish_group_activity','publish_group_announcement','update_academic_group',
      'create_recurring_schedule','configure_recurring_schedule','set_recurring_schedule_paused',
      'configure_recurring_slot','create_academic_blackout','set_academic_blackout_active',
      'run_due_recurring_schedule','run_due_recurring_schedule_locked_body',
      'decide_blocked_recurring_instance','calendar_overview','calendar_available_sections',
      'change_activity_window','supervisory_overview','supervisory_student_detail','calendar_instance_history')))),33::bigint,
  'all 33 Session 2 elevated functions remain fixed-path SECURITY DEFINER');
select ok(exists(select 1 from pg_indexes where schemaname='public' and indexname=name),
  name||' exists') from unnest(array[
  'one_current_group_membership','unique_department_group_name',
  'unique_department_schedule_name','recurring_instances_schedule_id_slot_id_cycle_monday_key']) name;
select ok(exists(select 1 from pg_trigger where tgname=name and not tgisinternal),
  name||' exists') from unnest(array[
  'academic_group_validate','academic_group_scope_guard','group_membership_validate',
  'recurring_schedule_validate','recurring_section_validate','recurring_slot_validate',
  'blackout_validate','blackout_department_lock','counselor_mapping_serialize']) name;
select * from finish();
rollback;
