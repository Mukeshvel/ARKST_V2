begin;

-- Abort without changing existing records if trusted data violates the new relationships.
do $$
begin
  if exists (
    select 1 from public.department_student_roster s
    join public.scopes d on d.id=s.department_scope_id
    join public.scopes sec on sec.id=s.section_scope_id
    where d.kind<>'department' or sec.kind<>'section' or sec.parent_id is distinct from d.id
  ) or exists (
    select 1 from public.counselor_student_mappings m
    join public.department_student_roster s on s.id=m.roster_student_id
    join public.responsibility_assignments r on r.id=m.counselor_responsibility_id
    where r.role<>'counselor' or (r.scope_id<>s.department_scope_id and r.scope_id<>s.section_scope_id)
  ) then
    raise exception 'Existing directory relationships need operator review before migration' using errcode='23514';
  end if;
end $$;

create extension if not exists btree_gist with schema extensions;
alter table public.counselor_student_mappings add constraint one_primary_counselor_per_instant
  exclude using gist (roster_student_id with =,
    tstzrange(starts_at,coalesce(ends_at,'infinity'::timestamptz),'[)') with &&);

-- Defense in depth for direct owner/service-role writes and later updates.
create function activity_private.validate_directory_relationships() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_student public.department_student_roster;
begin
  if tg_table_name='department_student_roster' then
    if not exists(select 1 from public.scopes d join public.scopes sec on sec.parent_id=d.id
      where d.id=new.department_scope_id and d.kind='department'
        and sec.id=new.section_scope_id and sec.kind='section') then
      raise exception 'Roster section must belong to its department' using errcode='23514';
    end if;
    if tg_op='UPDATE' and exists(
      select 1 from public.counselor_student_mappings m
      join public.responsibility_assignments r on r.id=m.counselor_responsibility_id
      where m.roster_student_id=new.id and r.scope_id<>new.department_scope_id
        and r.scope_id<>new.section_scope_id
    ) then
      raise exception 'Roster change would invalidate counselor history' using errcode='23514';
    end if;
  elsif tg_table_name='counselor_student_mappings' then
    select * into v_student from public.department_student_roster where id=new.roster_student_id;
    if not exists(select 1 from public.responsibility_assignments r
      where r.id=new.counselor_responsibility_id and r.role='counselor'
        and r.scope_id in (v_student.department_scope_id,v_student.section_scope_id)) then
      raise exception 'Mapping requires an in-scope counselor responsibility' using errcode='23514';
    end if;
  end if;
  return new;
end $$;
create trigger roster_relationship_guard before insert or update of department_scope_id,section_scope_id
  on public.department_student_roster for each row execute function activity_private.validate_directory_relationships();
create trigger counselor_relationship_guard before insert or update of roster_student_id,counselor_responsibility_id
  on public.counselor_student_mappings for each row execute function activity_private.validate_directory_relationships();

-- A responsibility's role/scope cannot be rewritten underneath recorded mappings.
create function activity_private.guard_mapped_responsibility() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.counselor_student_mappings where counselor_responsibility_id=old.id)
    and (new.role is distinct from old.role or new.scope_id is distinct from old.scope_id) then
    raise exception 'Mapped counselor role/scope cannot be rewritten' using errcode='23514';
  end if;
  return new;
end $$;
create trigger mapped_responsibility_guard before update of role,scope_id
  on public.responsibility_assignments for each row execute function activity_private.guard_mapped_responsibility();

create function activity_private.guard_directory_scope() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if (new.kind is distinct from old.kind or new.parent_id is distinct from old.parent_id)
    and (exists(select 1 from public.department_student_roster where department_scope_id=old.id)
      or exists(select 1 from public.department_student_roster where section_scope_id=old.id)) then
    raise exception 'Roster department/section relationship cannot be rewritten' using errcode='23514';
  end if;
  return new;
end $$;
create trigger directory_scope_guard before update of kind,parent_id
  on public.scopes for each row execute function activity_private.guard_directory_scope();

-- Keep the 3A exact-scope read/verify rule. Only create fans out to child sections.
create or replace function activity_private.can_manage(p_scope uuid,p_category text,p_operation text)
returns boolean language sql stable security definer set search_path='' as $$
 select activity_private.active_kind()='staff' and exists(
   select 1 from public.responsibility_assignments r
   join public.activity_capabilities c on c.responsibility_id=r.id
   join public.scopes granted on granted.id=r.scope_id
   join public.scopes target on target.id=p_scope
   where r.user_id=auth.uid() and c.category_key=p_category
     and r.starts_at<=now() and (r.ends_at is null or now()<r.ends_at)
     and ((r.scope_id=p_scope and target.kind in ('department','section'))
       or (p_operation='create' and granted.kind='department'
         and target.kind='section' and target.parent_id=granted.id))
     and case p_operation when 'create' then c.can_create when 'verify' then c.can_verify
       when 'read' then (c.can_create or c.can_verify) else false end
 )
$$;

-- Inactive roster rows and expired mappings remain stored but leave ordinary monitoring.
create or replace function activity_private.can_see_roster(p_roster uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.department_student_roster s where s.id=p_roster and s.active and (
   (s.linked_student_id=auth.uid() and activity_private.active_kind()='student')
   or (activity_private.active_kind()='staff' and exists(
     select 1 from public.counselor_student_mappings m
     join public.responsibility_assignments r on r.id=m.counselor_responsibility_id
     where m.roster_student_id=s.id and r.user_id=auth.uid() and r.role='counselor'
       and r.starts_at<=now() and (r.ends_at is null or now()<r.ends_at)
       and m.starts_at<=now() and (m.ends_at is null or now()<m.ends_at)
   ))
 ))
$$;
drop policy own_counselor_mappings on public.counselor_student_mappings;
create policy own_counselor_mappings on public.counselor_student_mappings for select to authenticated
  using (exists(select 1 from public.responsibility_assignments r
    join public.department_student_roster s on s.id=roster_student_id
    where r.id=counselor_responsibility_id and r.user_id=auth.uid() and r.role='counselor'
      and s.active and r.starts_at<=now() and (r.ends_at is null or now()<r.ends_at))
    and starts_at<=now() and (ends_at is null or now()<ends_at));

revoke all on function activity_private.validate_directory_relationships(),
  activity_private.guard_mapped_responsibility(),activity_private.guard_directory_scope()
  from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
