begin;

-- Concurrent duplicate requests cannot pass the 24-hour check together.
create unique index one_pending_catch_up_subject
  on public.catch_up_requests(student_id,subject)
  where status in ('submitted','approved');

-- Escalation case access follows the current trusted mapping or route. An old
-- recipient loses ordinary case access when reassigned; rows remain retained.
create or replace function activity_private.current_escalation_recipient(p_escalation uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select activity_private.active_kind()='staff' and exists(
    select 1 from public.activity_escalations e
    join public.responsibility_assignments r on r.id=e.recipient_responsibility_id
      and r.user_id=e.recipient_id and r.role=e.stage
    join public.activity_assignments x on x.id=e.assignment_id
    join public.department_student_roster s on s.linked_student_id=x.student_id and s.active
    where e.id=p_escalation and e.recipient_id=auth.uid()
      and r.starts_at<=now() and (r.ends_at is null or now()<r.ends_at)
      and ((e.stage='counselor' and exists(
        select 1 from public.counselor_student_mappings m
        where m.roster_student_id=s.id and m.counselor_responsibility_id=r.id
          and m.starts_at<=now() and (m.ends_at is null or now()<m.ends_at)))
        or (e.stage<>'counselor' and exists(
          select 1 from public.escalation_routes route where route.active
            and route.section_scope_id=s.section_scope_id
            and route.responsibility_id=r.id and route.target_role=e.stage)))
  )
$$;

create function activity_private.guard_escalation_route_responsibility() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if (new.user_id is distinct from old.user_id or new.role is distinct from old.role
      or new.scope_id is distinct from old.scope_id)
    and exists(select 1 from public.escalation_routes where responsibility_id=old.id and active) then
    raise exception 'Active escalation route responsibility cannot be reassigned.' using errcode='23514';
  end if;
  return new;
end $$;
create trigger escalation_responsibility_guard before update of user_id,role,scope_id
  on public.responsibility_assignments for each row
  execute function activity_private.guard_escalation_route_responsibility();

create function activity_private.guard_escalation_route_scope() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if (new.kind is distinct from old.kind or new.parent_id is distinct from old.parent_id)
    and (exists(select 1 from public.escalation_routes where section_scope_id=old.id and active)
      or exists(select 1 from public.escalation_routes route
        join public.responsibility_assignments r on r.id=route.responsibility_id
        where route.active and r.scope_id=old.id)) then
    raise exception 'Active escalation route scope cannot be rewritten.' using errcode='23514';
  end if;
  return new;
end $$;
create trigger escalation_scope_guard before update of kind,parent_id
  on public.scopes for each row execute function activity_private.guard_escalation_route_scope();

revoke all on function activity_private.guard_escalation_route_responsibility(),
  activity_private.guard_escalation_route_scope() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
