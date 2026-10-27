begin;

-- Roster identifiers are external strings, never assumed numeric/sequential.
create function activity_private.valid_subjects(p_subjects text[]) returns boolean
language sql immutable set search_path = '' as $$
 select p_subjects is not null and cardinality(p_subjects)<=20
   and array_position(p_subjects,null) is null
   and not exists(select 1 from unnest(p_subjects) s where char_length(btrim(s)) not between 1 and 100)
$$;

create table public.department_student_roster (
  id uuid primary key default gen_random_uuid(),
  department_scope_id uuid not null references public.scopes(id) on delete restrict,
  external_student_id text not null check (char_length(btrim(external_student_id)) between 1 and 80),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 160),
  institutional_email text check (institutional_email is null or char_length(institutional_email) <= 254),
  section_scope_id uuid not null references public.scopes(id) on delete restrict,
  linked_student_id uuid,
  linked_kind text not null default 'student' check (linked_kind = 'student'),
  active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (linked_student_id, linked_kind) references public.profiles(id, account_kind) on delete restrict,
  unique (department_scope_id, external_student_id),
  unique (linked_student_id),
  check (section_scope_id <> department_scope_id)
);
create index department_roster_section_idx on public.department_student_roster(section_scope_id, external_student_id);

create table public.counselor_student_mappings (
  id uuid primary key default gen_random_uuid(),
  roster_student_id uuid not null references public.department_student_roster(id) on delete restrict,
  counselor_responsibility_id uuid not null references public.responsibility_assignments(id) on delete restrict,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  unique (roster_student_id, counselor_responsibility_id, starts_at)
);
create index counselor_mappings_responsibility_idx on public.counselor_student_mappings(counselor_responsibility_id, roster_student_id);

create table public.staff_directory_profiles (
  user_id uuid primary key,
  staff_kind text not null default 'staff' check (staff_kind = 'staff'),
  teaching_status text not null check (teaching_status in ('teaching', 'non_teaching')),
  designation text not null default '' check (char_length(btrim(designation)) <= 120),
  subjects text[] not null default '{}',
  updated_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  foreign key (user_id, staff_kind) references public.profiles(id, account_kind) on delete cascade,
  check (activity_private.valid_subjects(subjects))
);

create table public.staff_section_preferences (
  user_id uuid not null references public.staff_directory_profiles(user_id) on delete cascade,
  section_scope_id uuid not null references public.scopes(id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key (user_id, section_scope_id)
);

create table public.department_directory_audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  entity_type text not null check (entity_type in ('staff_profile', 'staff_sections', 'student_roster', 'counselor_mapping', 'staff_provisioning')),
  entity_id uuid,
  action text not null check (action in ('created', 'updated', 'imported', 'linked')),
  changes jsonb not null check (jsonb_typeof(changes) = 'object'),
  occurred_at timestamptz not null default now()
);
create index directory_audit_actor_idx on public.department_directory_audit(actor_id, occurred_at desc);
create index directory_audit_entity_idx on public.department_directory_audit(entity_type, entity_id, occurred_at);

create function activity_private.can_self_edit_staff(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_user = auth.uid() and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.account_kind = 'staff' and p.is_active
  ) and exists (
    select 1 from public.responsibility_assignments r join public.scopes d on d.id = r.scope_id
    where r.user_id = auth.uid() and r.starts_at <= now() and (r.ends_at is null or now() < r.ends_at)
      and d.kind = 'department'
  )
$$;

create function activity_private.can_see_roster(p_roster uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists (select 1 from public.department_student_roster s where s.id=p_roster and (
   (s.linked_student_id=auth.uid() and activity_private.active_kind()='student')
   or (activity_private.active_kind()='staff' and exists (
     select 1 from public.counselor_student_mappings m
     join public.responsibility_assignments r on r.id=m.counselor_responsibility_id
     where m.roster_student_id=s.id and r.user_id=auth.uid() and r.role='counselor'
       and r.starts_at<=now() and (r.ends_at is null or now()<r.ends_at)
       and m.starts_at<=now() and (m.ends_at is null or now()<m.ends_at)
   ))
 ))
$$;

-- A department-level capability can cover its direct Sections A/B. It does not
-- grant parent traversal, student-profile access, or HOD/Admin capabilities.
create or replace function activity_private.can_manage(p_scope uuid,p_category text,p_operation text)
returns boolean language sql stable security definer set search_path = '' as $$
 select activity_private.active_kind()='staff' and exists(
   select 1 from public.responsibility_assignments r
   join public.activity_capabilities c on c.responsibility_id=r.id
   join public.scopes granted on granted.id=r.scope_id
   join public.scopes target on target.id=p_scope
   where r.user_id=auth.uid() and c.category_key=p_category
     and r.starts_at<=now() and (r.ends_at is null or now()<r.ends_at)
     and ((r.scope_id=p_scope and target.kind in ('department','section'))
       or (granted.kind='department' and target.kind='section' and target.parent_id=granted.id))
     and case p_operation when 'create' then c.can_create when 'verify' then c.can_verify
       when 'read' then (c.can_create or c.can_verify) else false end
 )
$$;

create function public.update_staff_directory_profile(
  p_teaching_status text, p_designation text, p_subjects text[], p_section_ids uuid[]
) returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_before jsonb; v_sections jsonb;
begin
  if not activity_private.can_self_edit_staff(v_actor) then
    raise exception 'Active department staff profile required.' using errcode='42501';
  end if;
  if p_teaching_status not in ('teaching','non_teaching')
    or p_designation is null or char_length(btrim(p_designation))>120
    or p_subjects is null or cardinality(p_subjects)>20 or array_position(p_subjects,null) is not null
    or exists(select 1 from unnest(p_subjects) s where char_length(btrim(s)) not between 1 and 100)
    or p_section_ids is null or cardinality(p_section_ids)>100
    or array_position(p_section_ids,null) is not null
    or cardinality(p_section_ids)<>(select count(distinct x) from unnest(p_section_ids) x) then
    raise exception 'Invalid staff directory profile.' using errcode='22023';
  end if;
  if exists(select 1 from unnest(p_section_ids) x where not exists (
    select 1 from public.scopes s join public.responsibility_assignments r on r.scope_id=s.parent_id
    join public.scopes d on d.id=r.scope_id
    where s.id=x and s.kind='section' and d.kind='department' and r.user_id=v_actor
      and r.starts_at<=now() and (r.ends_at is null or now()<r.ends_at)
  )) then raise exception 'Section preference is outside the approved department.' using errcode='42501'; end if;
  select jsonb_build_object('teaching_status',d.teaching_status,'designation',d.designation,'subjects',d.subjects,
    'sections',coalesce((select jsonb_agg(section_scope_id order by section_scope_id) from public.staff_section_preferences where user_id=v_actor),'[]'::jsonb))
    into v_before from public.staff_directory_profiles d where d.user_id=v_actor;
  insert into public.staff_directory_profiles(user_id,teaching_status,designation,subjects,updated_by)
    values(v_actor,p_teaching_status,btrim(p_designation),p_subjects,v_actor)
    on conflict(user_id) do update set teaching_status=excluded.teaching_status, designation=excluded.designation,
      subjects=excluded.subjects, updated_by=v_actor, updated_at=now();
  update public.profiles set staff_classification=p_teaching_status where id=v_actor and account_kind='staff';
  delete from public.staff_section_preferences where user_id=v_actor;
  insert into public.staff_section_preferences(user_id,section_scope_id)
    select v_actor,x from unnest(p_section_ids) x;
  select coalesce(jsonb_agg(section_scope_id order by section_scope_id),'[]'::jsonb) into v_sections
    from public.staff_section_preferences where user_id=v_actor;
  insert into public.department_directory_audit(actor_id,entity_type,entity_id,action,changes)
    values(v_actor,'staff_profile',v_actor,case when v_before is null then 'created' else 'updated' end,
      jsonb_build_object('before',coalesce(v_before,'null'::jsonb),'after',jsonb_build_object(
        'teaching_status',p_teaching_status,'designation',btrim(p_designation),'subjects',p_subjects,'sections',v_sections)));
end;
$$;

create function public.staff_available_sections() returns table(id uuid,name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not activity_private.can_self_edit_staff(auth.uid()) then
    raise exception 'Active department staff profile required.' using errcode='42501';
  end if;
  return query select distinct s.id,s.name from public.scopes s
    join public.responsibility_assignments r on r.scope_id=s.parent_id
    join public.scopes d on d.id=r.scope_id
    where s.kind='section' and d.kind='department' and r.user_id=auth.uid()
      and r.starts_at<=now() and (r.ends_at is null or now()<r.ends_at)
    order by s.name,s.id;
end;
$$;

alter table public.department_student_roster enable row level security;
alter table public.counselor_student_mappings enable row level security;
alter table public.staff_directory_profiles enable row level security;
alter table public.staff_section_preferences enable row level security;
alter table public.department_directory_audit enable row level security;
revoke all on public.department_student_roster,public.counselor_student_mappings,public.staff_directory_profiles,
  public.staff_section_preferences,public.department_directory_audit from public,anon,authenticated;
grant select on public.department_student_roster,public.counselor_student_mappings,public.staff_directory_profiles,
  public.staff_section_preferences,public.department_directory_audit to authenticated;
revoke select on public.department_student_roster from authenticated;
grant select(id,department_scope_id,external_student_id,display_name,section_scope_id,linked_student_id,active,created_at,updated_at)
  on public.department_student_roster to authenticated;
grant all on public.department_student_roster,public.counselor_student_mappings,public.staff_directory_profiles,
  public.staff_section_preferences,public.department_directory_audit to service_role;
revoke all on sequence public.department_directory_audit_id_seq from public,anon,authenticated;
grant usage,select on sequence public.department_directory_audit_id_seq to service_role;

create policy roster_scoped_read on public.department_student_roster for select to authenticated
  using (activity_private.can_see_roster(id));
create policy own_counselor_mappings on public.counselor_student_mappings for select to authenticated
  using (exists(select 1 from public.responsibility_assignments r where r.id=counselor_responsibility_id
    and r.user_id=auth.uid() and r.role='counselor' and r.starts_at<=now() and (r.ends_at is null or now()<r.ends_at))
    and starts_at<=now() and (ends_at is null or now()<ends_at));
create policy own_staff_directory on public.staff_directory_profiles for select to authenticated
  using (user_id=auth.uid() and activity_private.can_self_edit_staff(user_id));
create policy own_staff_preferences on public.staff_section_preferences for select to authenticated
  using (user_id=auth.uid() and activity_private.can_self_edit_staff(user_id));
create policy own_directory_audit on public.department_directory_audit for select to authenticated
  using (actor_id=auth.uid());

revoke all on function public.update_staff_directory_profile(text,text,text[],uuid[]) from public,anon,authenticated;
grant execute on function public.update_staff_directory_profile(text,text,text[],uuid[]) to authenticated;
revoke all on function public.staff_available_sections() from public,anon,authenticated;
grant execute on function public.staff_available_sections() to authenticated;
revoke all on all functions in schema activity_private from public,anon,authenticated;
grant execute on all functions in schema activity_private to authenticated;
notify pgrst,'reload schema';
commit;
