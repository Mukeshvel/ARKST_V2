begin;

-- Serialize blackout writes against due generation for the whole department.
-- The existing runner remains unchanged and is called only inside the lock.
alter function public.run_due_recurring_schedule(uuid,date) rename to run_due_recurring_schedule_locked_body;
revoke all on function public.run_due_recurring_schedule_locked_body(uuid,date) from public,anon,authenticated;
create function public.run_due_recurring_schedule(p_schedule uuid,p_through date default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_department uuid;
begin
  select department_scope_id into v_department from public.recurring_schedules where id=p_schedule;
  if not found or not coalesce(activity_private.can_department_operation(v_department,'calendar'),false) then
    raise exception 'Calendar runner is not permitted.' using errcode='42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_department::text,92374));
  return public.run_due_recurring_schedule_locked_body(p_schedule,p_through);
end $$;
revoke all on function public.run_due_recurring_schedule(uuid,date) from public,anon,authenticated;
grant execute on function public.run_due_recurring_schedule(uuid,date) to authenticated;
create function activity_private.lock_blackout_department() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.department_scope_id::text,92374));
  return new;
end $$;
create trigger blackout_department_lock before insert or update on public.academic_blackouts
  for each row execute function activity_private.lock_blackout_department();
revoke all on function activity_private.lock_blackout_department() from public,anon,authenticated;

create function public.calendar_available_sections(p_department uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_rows jsonb;
begin
  if not coalesce(activity_private.can_department_operation(p_department,'calendar'),false) then
    raise exception 'Calendar sections are not permitted.' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name) order by s.name,s.id),'[]'::jsonb)
    into v_rows from public.scopes s where s.kind='section' and s.parent_id=p_department;
  return v_rows;
end $$;
revoke all on function public.calendar_available_sections(uuid) from public,anon,authenticated;
grant execute on function public.calendar_available_sections(uuid) to authenticated;

create table public.academic_group_changes (
  id bigint generated always as identity primary key,
  group_id uuid not null references public.academic_groups(scope_id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  old_name text not null,
  new_name text not null,
  old_type text not null,
  new_type text not null,
  old_active boolean not null,
  new_active boolean not null,
  occurred_at timestamptz not null default now()
);
create index group_changes_group_time on public.academic_group_changes(group_id,id);
alter table public.academic_group_changes enable row level security;
revoke all on public.academic_group_changes from public,anon,authenticated;
grant all on public.academic_group_changes to service_role;
revoke all on sequence public.academic_group_changes_id_seq from public,anon,authenticated;
grant usage,select on sequence public.academic_group_changes_id_seq to service_role;
create function public.update_academic_group(p_group uuid,p_name text,p_type text,p_active boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_group public.academic_groups; v_name text;
begin
  select * into v_group from public.academic_groups where scope_id=p_group for update;
  if not found or not coalesce(activity_private.can_department_operation(v_group.department_scope_id,'groups'),false) then
    raise exception 'Group management is not permitted.' using errcode='42501';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 120
    or p_type is null or char_length(btrim(p_type)) not between 1 and 80 or p_active is null then
    raise exception 'Invalid group edit.' using errcode='22023';
  end if;
  select name into v_name from public.scopes where id=p_group for update;
  if v_name=btrim(p_name) and v_group.group_type=btrim(p_type) and v_group.active=p_active then
    raise exception 'Group edit is unchanged.' using errcode='22023';
  end if;
  update public.scopes set name=btrim(p_name) where id=p_group;
  update public.academic_groups set group_type=btrim(p_type),active=p_active,
    updated_by=auth.uid(),updated_at=now() where scope_id=p_group;
  insert into public.academic_group_changes(group_id,actor_id,old_name,new_name,
    old_type,new_type,old_active,new_active)
    values(p_group,auth.uid(),v_name,btrim(p_name),v_group.group_type,btrim(p_type),v_group.active,p_active);
  return jsonb_build_object('id',p_group,'name',btrim(p_name),'type',btrim(p_type),'active',p_active);
end $$;
revoke all on function public.update_academic_group(uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.update_academic_group(uuid,text,text,boolean) to authenticated;

notify pgrst,'reload schema';
commit;
