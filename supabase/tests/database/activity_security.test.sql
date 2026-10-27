-- Real PostgreSQL assertions. SQL role contexts are not Auth/session substitutes.
-- The separate activity integration suite signs in through real Supabase Auth.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
grant usage on schema extensions to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;
select no_plan();

select ok((select relrowsecurity from pg_class where oid = ('public.' || name)::regclass), name || ' enables RLS')
from unnest(array['activity_categories', 'student_scope_memberships', 'activity_capabilities',
  'activities', 'activity_assignments', 'activity_completions', 'activity_history']) name;
select ok(not has_table_privilege('authenticated', 'public.' || name, 'INSERT,UPDATE,DELETE'), name || ' denies direct authenticated writes')
from unnest(array['activity_categories', 'student_scope_memberships', 'activity_capabilities',
  'activities', 'activity_assignments', 'activity_completions', 'activity_history']) name;
select ok(not has_table_privilege('anon', 'public.' || name, 'SELECT'), name || ' denies anonymous reads')
from unnest(array['activity_categories', 'student_scope_memberships', 'activity_capabilities',
  'activities', 'activity_assignments', 'activity_completions', 'activity_history']) name;
select ok(not has_table_privilege('authenticated', 'public.student_scope_memberships', 'SELECT'), 'no student roster grant');
select ok(not has_table_privilege('authenticated', 'public.activity_capabilities', 'SELECT'), 'no capability directory grant');
select ok(not has_function_privilege('anon', 'public.' || signature, 'EXECUTE'), signature || ' denies anonymous execution')
from unnest(array['create_activity(text,uuid,text,text,timestamptz,timestamptz,timestamptz,boolean,uuid[])', 'submit_activity(uuid)', 'verify_activity(uuid)']) signature;
select ok(p.prosecdef and 'search_path=""' = any(p.proconfig), p.proname || ' has fixed empty definer search path')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'activity_private' or (n.nspname='public' and p.proname in ('create_activity','submit_activity','verify_activity'));

insert into auth.users(id, aud, role, email) values
  ('30000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'sql-activity-student@example.invalid'),
  ('30000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'sql-activity-staff@example.invalid');
insert into public.profiles(id, display_name, account_kind, staff_classification, is_active) values
  ('30000000-0000-4000-8000-000000000001', 'SQL student', 'student', null, true),
  ('30000000-0000-4000-8000-000000000002', 'SQL staff', 'staff', 'teaching', true);
insert into public.scopes(id, name, kind) values ('31000000-0000-4000-8000-000000000001', 'SQL department', 'department');
insert into public.responsibility_assignments(id, user_id, role, scope_id) values
  ('32000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', 'teacher', '31000000-0000-4000-8000-000000000001');
insert into public.student_scope_memberships(student_id, scope_id) values
  ('30000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001');
insert into public.activity_capabilities(responsibility_id, category_key, can_create, can_verify) values
  ('32000000-0000-4000-8000-000000000001', 'general', true, true);

select throws_ok($$insert into public.student_scope_memberships(student_id, scope_id) values
  ('30000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000001')$$, '23503', null, 'staff cannot be a student member');

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000002', true);
select set_config('test.activity_id', public.create_activity('general', '31000000-0000-4000-8000-000000000001',
  'SQL boundary task', '', now(), now() + interval '1 hour', now() + interval '2 hours', true,
  array['30000000-0000-4000-8000-000000000001'::uuid])::text, true);
select is((select count(*) from public.activities where id=current_setting('test.activity_id')::uuid), 1::bigint, 'creator reads authorized activity');
select set_config('test.assignment_id', (select id::text from public.activity_assignments where activity_id=current_setting('test.activity_id')::uuid), true);
select throws_ok($$select public.verify_activity(current_setting('test.assignment_id')::uuid)$$, '23505', null, 'pending cannot skip submission');
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000001', true);
select is((public.submit_activity(current_setting('test.assignment_id')::uuid)).state, 'reported', 'inclusive start allows submission, required verification stays reported');
select throws_ok($$select public.submit_activity(current_setting('test.assignment_id')::uuid)$$, '23505', null, 'duplicate completion rejected');
select throws_ok($$select public.verify_activity(current_setting('test.assignment_id')::uuid)$$, '42501', null, 'student cannot self-verify');
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000002', true);
select is((public.verify_activity(current_setting('test.assignment_id')::uuid)).state, 'verified', 'explicit reviewer verifies reported work');
select throws_ok($$select public.verify_activity(current_setting('test.assignment_id')::uuid)$$, '23505', null, 'verified cannot verify again');
reset role;

select throws_ok($$insert into public.activity_assignments(activity_id, student_id, assigned_by) values
  (current_setting('test.activity_id')::uuid, '30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002')$$,
  '23505', null, 'assignment uniqueness is enforced by PostgreSQL');
select throws_ok($$update public.activity_completions set state='pending' where assignment_id=current_setting('test.assignment_id')::uuid$$,
  '23514', null, 'completion table rejects unknown transitions/status');
select throws_ok($$update public.activities set deadline_at=starts_at where id=current_setting('test.activity_id')::uuid$$,
  '23514', null, 'equal window boundary rejected by PostgreSQL');
select throws_ok($$update public.activities set ends_at='infinity' where id=current_setting('test.activity_id')::uuid$$,
  '23514', null, 'infinite timestamp rejected by PostgreSQL');
select throws_ok($$update public.activity_completions set verified_by=submitted_by where assignment_id=current_setting('test.assignment_id')::uuid$$,
  '23514', null, 'self-verification rejected by PostgreSQL constraint');

-- Deadline is exclusive even if the end is still in the future.
delete from public.activity_completions where assignment_id=current_setting('test.assignment_id')::uuid;
update public.activities set starts_at=now()-interval '1 hour', deadline_at=now(), ends_at=now()+interval '1 hour'
  where id=current_setting('test.activity_id')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000001', true);
select throws_ok($$select public.submit_activity(current_setting('test.assignment_id')::uuid)$$,
  '22023', null, 'exact deadline is closed according to database time');
select set_config('request.jwt.claim.sub', '', true);
select is((select count(*) from public.activities), 0::bigint, 'missing actor reveals no activities');
select throws_ok($$select public.submit_activity(current_setting('test.assignment_id')::uuid)$$,
  '42501', null, 'missing actor cannot execute privileged submit');
reset role;
-- Exercise the intended department size with real transaction-local database rows.
create temporary table bulk_students (id uuid primary key);
insert into bulk_students select gen_random_uuid() from generate_series(1, 130);
grant select on bulk_students to authenticated;
insert into auth.users(id, aud, role, email)
  select id, 'authenticated', 'authenticated', id::text || '@example.invalid' from bulk_students;
insert into public.profiles(id, display_name, account_kind, is_active)
  select id, 'SQL bulk student', 'student', true from bulk_students;
insert into public.student_scope_memberships(student_id, scope_id)
  select id, '31000000-0000-4000-8000-000000000001' from bulk_students;
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000002', true);
select set_config('test.bulk_activity_id', public.create_activity('general', '31000000-0000-4000-8000-000000000001',
  '130 student publication', '', now(), now()+interval '1 hour', now()+interval '2 hours', false,
  array(select id from bulk_students))::text, true);
select is((select count(*) from public.activity_assignments where activity_id=current_setting('test.bulk_activity_id')::uuid),
  130::bigint, 'all 130 direct targets persist');
select is((select count(*) from public.activity_history where activity_id=current_setting('test.bulk_activity_id')::uuid),
  131::bigint, '130 assignment events and one creation event persist');
select set_config('request.jwt.claim.sub', (select id::text from bulk_students limit 1), true);
select is((select count(*) from public.activity_assignments where activity_id=current_setting('test.bulk_activity_id')::uuid),
  1::bigint, 'one student sees only their assignment in a 130-target publication');
select is((select count(*) from public.activity_history where activity_id=current_setting('test.bulk_activity_id')::uuid),
  1::bigint, 'one student sees only their history in a 130-target publication');
reset role;
select * from finish();
rollback;
