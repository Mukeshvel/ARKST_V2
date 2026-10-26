-- Database policy tests only: set_config is a PostgreSQL test role context.
-- It is NOT a simulated application login and does not verify Supabase Auth.
-- Fixtures roll back. Genuine password/session tests are separate integration tests.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
-- Temporary test-only access to assertion helpers (rolled back below).
grant usage on schema extensions to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;
select no_plan();

insert into auth.users (id, aud, role, email) values
  ('00000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'rls-a@example.invalid'),
  ('00000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'rls-b@example.invalid'),
  ('00000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'rls-staff@example.invalid'),
  ('00000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'rls-inactive@example.invalid'),
  ('00000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'rls-unprovisioned@example.invalid');
insert into public.profiles (id, display_name, account_kind, staff_classification, is_active) values
  ('00000000-0000-4000-8000-000000000001', 'RLS Student A', 'student', null, true),
  ('00000000-0000-4000-8000-000000000002', 'RLS Student B', 'student', null, true),
  ('00000000-0000-4000-8000-000000000003', 'RLS Staff', 'staff', 'non_teaching', true),
  ('00000000-0000-4000-8000-000000000004', 'RLS Inactive', 'staff', 'teaching', false);
insert into public.scopes (id, name, kind) values
  ('10000000-0000-4000-8000-000000000001', 'RLS Department', 'department'),
  ('10000000-0000-4000-8000-000000000002', 'RLS Other Department', 'department');
insert into public.responsibility_assignments (user_id, role, scope_id, starts_at, ends_at) values
  ('00000000-0000-4000-8000-000000000003', 'teacher', '10000000-0000-4000-8000-000000000001', now() - interval '1 day', null),
  ('00000000-0000-4000-8000-000000000003', 'counselor', '10000000-0000-4000-8000-000000000001', now() - interval '1 day', null),
  ('00000000-0000-4000-8000-000000000003', 'placement_coordinator', '10000000-0000-4000-8000-000000000001', now() - interval '1 day', null),
  ('00000000-0000-4000-8000-000000000003', 'admin', '10000000-0000-4000-8000-000000000002', now() + interval '1 day', null),
  ('00000000-0000-4000-8000-000000000003', 'hod', '10000000-0000-4000-8000-000000000002', now() - interval '2 days', now()),
  ('00000000-0000-4000-8000-000000000004', 'teacher', '10000000-0000-4000-8000-000000000001', now() - interval '1 day', null);

select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.responsibility_assignments'::regclass), 'roles RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.scopes'::regclass), 'scopes RLS enabled');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'INSERT'), 'no profile INSERT grant');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'UPDATE'), 'no profile UPDATE grant');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'DELETE'), 'no profile DELETE grant');
select ok(not has_table_privilege('authenticated', 'public.responsibility_assignments', 'INSERT'), 'no role INSERT grant');
select ok(not has_table_privilege('authenticated', 'public.responsibility_assignments', 'UPDATE'), 'no role UPDATE grant');
select ok(not has_table_privilege('authenticated', 'public.responsibility_assignments', 'DELETE'), 'no role DELETE grant');

set local role anon;
select throws_ok('select * from public.profiles', '42501', 'permission denied for table profiles', 'anonymous profile read denied');
select throws_ok('select * from public.responsibility_assignments', '42501', 'permission denied for table responsibility_assignments', 'anonymous role read denied');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select is((select count(*) from public.profiles), 1::bigint, 'student sees own active profile');
select is((select count(*) from public.profiles where id = '00000000-0000-4000-8000-000000000002'), 0::bigint, 'student cannot read another profile');
select is((select count(*) from public.responsibility_assignments), 0::bigint, 'student cannot see staff responsibilities');
select is((select count(*) from public.scopes), 0::bigint, 'student cannot browse scopes');
select throws_ok($$update public.profiles set account_kind = 'staff', staff_classification = 'teaching'$$, '42501', 'permission denied for table profiles', 'student cannot promote own profile');
select throws_ok($$insert into public.responsibility_assignments (user_id, role, scope_id) values ('00000000-0000-4000-8000-000000000001', 'counselor', '10000000-0000-4000-8000-000000000001')$$, '42501', 'permission denied for table responsibility_assignments', 'cannot self-assign counselor');
select throws_ok($$insert into public.responsibility_assignments (user_id, role, scope_id) values ('00000000-0000-4000-8000-000000000001', 'coordinator', '10000000-0000-4000-8000-000000000001')$$, '42501', 'permission denied for table responsibility_assignments', 'cannot self-assign coordinator');
select throws_ok($$insert into public.responsibility_assignments (user_id, role, scope_id) values ('00000000-0000-4000-8000-000000000001', 'hod', '10000000-0000-4000-8000-000000000001')$$, '42501', 'permission denied for table responsibility_assignments', 'cannot self-assign HOD');
select throws_ok($$insert into public.responsibility_assignments (user_id, role, scope_id) values ('00000000-0000-4000-8000-000000000001', 'admin', '10000000-0000-4000-8000-000000000001')$$, '42501', 'permission denied for table responsibility_assignments', 'cannot self-assign admin');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select is((select count(*) from public.profiles), 1::bigint, 'staff sees own profile only');
select is((select count(*) from public.profiles where account_kind = 'student'), 0::bigint, 'staff roles do not reveal students');
select is((select count(*) from public.responsibility_assignments), 3::bigint, 'multiple active responsibilities returned; expired/future excluded');
select is((select count(*) from public.scopes), 1::bigint, 'only exact active responsibility scope visible');
select throws_ok($$delete from public.responsibility_assignments$$, '42501', 'permission denied for table responsibility_assignments', 'staff cannot delete responsibility records');
select throws_ok($$update public.responsibility_assignments set role = 'admin'$$, '42501', 'permission denied for table responsibility_assignments', 'staff cannot escalate role');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select is((select count(*) from public.profiles), 0::bigint, 'inactive account profile denied');
select is((select count(*) from public.responsibility_assignments), 0::bigint, 'inactive account responsibilities denied');
select is((select count(*) from public.scopes), 0::bigint, 'inactive account scopes denied');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000005', true);
select is((select count(*) from public.profiles), 0::bigint, 'unprovisioned account denied');
select set_config('request.jwt.claim.sub', '', true);
select is((select count(*) from public.profiles), 0::bigint, 'missing identity fails closed');
select set_config('request.jwt.claim.sub', 'not-a-uuid', true);
select throws_ok('select * from public.profiles', '22P02', null, 'malformed database identity context fails closed');
reset role;

insert into public.responsibility_assignments (user_id, role, scope_id) values
  ('00000000-0000-4000-8000-000000000003', 'admin', '10000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select is((select count(*) from public.profiles where account_kind = 'student'), 0::bigint, 'application admin role is not a database RLS bypass');
select throws_ok($$update public.responsibility_assignments set role = 'hod'$$, '42501', 'permission denied for table responsibility_assignments', 'application admin still cannot mutate roles through client');
reset role;

select throws_ok($$insert into public.responsibility_assignments (user_id, role, scope_id) values ('00000000-0000-4000-8000-000000000001', 'teacher', '10000000-0000-4000-8000-000000000001')$$, '23503', null, 'even trusted provisioning cannot assign staff role to student');
select throws_ok($$insert into public.profiles (id, display_name, account_kind, staff_classification) values ('00000000-0000-4000-8000-000000000005', 'Wrong classification', 'student', 'teaching')$$, '23514', null, 'classification constraint is enforced');
select * from finish();
rollback;
