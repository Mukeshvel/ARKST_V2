-- RLS and RPC assertions on the local PostgreSQL migration.
-- Genuine cookies and Auth login are covered by test-local-directory.mjs.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
grant usage on schema extensions to anon,authenticated;
grant execute on all functions in schema extensions to anon,authenticated;
select no_plan();

select ok((select relrowsecurity from pg_class where oid=('public.'||name)::regclass),name||' has RLS')
from unnest(array['department_student_roster','counselor_student_mappings','staff_directory_profiles','staff_section_preferences','department_directory_audit']) name;
select ok(not has_table_privilege('authenticated','public.'||name,'INSERT,UPDATE,DELETE'),name||' denies direct client writes')
from unnest(array['department_student_roster','counselor_student_mappings','staff_directory_profiles','staff_section_preferences','department_directory_audit']) name;
select ok(not has_column_privilege('authenticated','public.department_student_roster','institutional_email','SELECT'),'counselor roster access excludes institutional email');
select ok(not has_function_privilege('anon','public.update_staff_directory_profile(text,text,text[],uuid[])','EXECUTE'),'anonymous cannot update staff profile');
select ok(exists(select 1 from pg_constraint where conrelid='public.counselor_student_mappings'::regclass and conname='one_primary_counselor_per_instant' and contype='x'),'database excludes overlapping primary counselor intervals');
select ok(exists(select 1 from pg_trigger where tgrelid='public.department_student_roster'::regclass and tgname='roster_relationship_guard' and not tgisinternal),'database validates roster department and section');
select ok(exists(select 1 from pg_trigger where tgrelid='public.counselor_student_mappings'::regclass and tgname='counselor_relationship_guard' and not tgisinternal),'database validates counselor role and scope');

insert into auth.users(id,aud,role,email) values
('40000000-0000-4000-8000-000000000001','authenticated','authenticated','directory-student-a@example.invalid'),
('40000000-0000-4000-8000-000000000002','authenticated','authenticated','directory-student-b@example.invalid'),
('40000000-0000-4000-8000-000000000003','authenticated','authenticated','directory-counselor@example.invalid'),
('40000000-0000-4000-8000-000000000004','authenticated','authenticated','directory-teacher@example.invalid');
insert into public.profiles(id,display_name,account_kind,staff_classification,is_active) values
('40000000-0000-4000-8000-000000000001','Directory Student A','student',null,true),
('40000000-0000-4000-8000-000000000002','Directory Student B','student',null,true),
('40000000-0000-4000-8000-000000000003','Directory Counselor','staff','teaching',true),
('40000000-0000-4000-8000-000000000004','Directory Teacher','staff','teaching',true);
insert into public.scopes(id,name,kind) values('41000000-0000-4000-8000-000000000001','Directory Department','department');
insert into public.scopes(id,name,kind,parent_id) values
('41000000-0000-4000-8000-000000000002','Section A','section','41000000-0000-4000-8000-000000000001'),
('41000000-0000-4000-8000-000000000003','Section B','section','41000000-0000-4000-8000-000000000001');
insert into public.responsibility_assignments(id,user_id,role,scope_id) values
('42000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000003','counselor','41000000-0000-4000-8000-000000000001'),
('42000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000004','teacher','41000000-0000-4000-8000-000000000001');
insert into public.department_student_roster(id,department_scope_id,external_student_id,display_name,section_scope_id,linked_student_id,created_by) values
('43000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001','1042','Roster A','41000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000003'),
('43000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000001','STU-B-90001','Roster B','41000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000003');
insert into public.counselor_student_mappings(roster_student_id,counselor_responsibility_id,created_by) values
('43000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000003');

set local role authenticated;
select set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000003',true);
select is((select count(*) from public.staff_available_sections()),2::bigint,'active department staff see only that department sections');
select public.update_staff_directory_profile('non_teaching','Custom Placement Coordinator',array['Placement'],array['41000000-0000-4000-8000-000000000002'::uuid,'41000000-0000-4000-8000-000000000003'::uuid]);
select is((select staff_classification from public.profiles where id=auth.uid()),'non_teaching','self-service status remains descriptive profile classification');
select is((select count(*) from public.staff_section_preferences where user_id=auth.uid()),2::bigint,'Both preferences persisted');
select is((select count(*) from public.counselor_student_mappings where counselor_responsibility_id='42000000-0000-4000-8000-000000000001'),1::bigint,'teaching profile edits do not change counselor mapping');
select is((select count(*) from public.department_student_roster),1::bigint,'counselor sees only mapped roster rows');
select is((select external_student_id from public.department_student_roster),'1042','non-consecutive external identifier remains exact text');
reset role;
update public.profiles set is_active=false where id='40000000-0000-4000-8000-000000000003';
set local role authenticated;
select is((select count(*) from public.counselor_student_mappings),0::bigint,'inactive counselor cannot read current mappings directly');
select is((select count(*) from public.department_student_roster),0::bigint,'inactive counselor cannot monitor roster');
reset role;
update public.profiles set is_active=true where id='40000000-0000-4000-8000-000000000003';
set local role authenticated;
select throws_ok($$update public.staff_directory_profiles set designation='HOD'$$,'42501','permission denied for table staff_directory_profiles','staff cannot bypass profile RPC');
select throws_ok($$insert into public.responsibility_assignments(user_id,role,scope_id) values(auth.uid(),'admin','41000000-0000-4000-8000-000000000001')$$,'42501','permission denied for table responsibility_assignments','profile fields cannot self grant admin');
select throws_ok($$insert into public.activity_capabilities(responsibility_id,category_key,can_create) values('42000000-0000-4000-8000-000000000001','general',true)$$,'42501','permission denied for table activity_capabilities','faculty cannot self grant Activity capability');
select throws_ok($$select public.update_staff_directory_profile('teaching','',array[''],array[]::uuid[])$$,'22023',null,'invalid subjects rejected transactionally');
select throws_ok($$select public.update_staff_directory_profile('teaching','',array['Java',' java '],array[]::uuid[])$$,'23514',null,'case-insensitive duplicate subjects rejected by database constraint');
select throws_ok($$select public.update_staff_directory_profile('teaching','',array[]::text[],array['41000000-0000-4000-8000-000000000001'::uuid])$$,'42501',null,'department root cannot be selected as a section');
select set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000004',true);
select is((select count(*) from public.department_student_roster),0::bigint,'non-counselor faculty cannot see roster');
select is((select count(*) from public.counselor_student_mappings),0::bigint,'non-counselor faculty cannot read mappings');
select is((select count(*) from public.staff_directory_profiles),0::bigint,'faculty cannot read another faculty profile');
select set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000001',true);
select is((select count(*) from public.staff_directory_profiles),0::bigint,'student cannot read faculty profile');
select throws_ok($$select public.update_staff_directory_profile('teaching','',array[]::text[],array[]::uuid[])$$,'42501',null,'student cannot edit a staff profile');
reset role;
select * from finish();
rollback;
