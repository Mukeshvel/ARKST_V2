begin;

create table public.department_operation_grant_history (
  id bigint generated always as identity primary key,
  responsibility_id uuid not null references public.responsibility_assignments(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  old_groups boolean not null,
  new_groups boolean not null,
  old_calendar boolean not null,
  new_calendar boolean not null,
  old_supervise boolean not null,
  new_supervise boolean not null,
  occurred_at timestamptz not null default now()
);
create index department_operation_grant_history_responsibility
  on public.department_operation_grant_history(responsibility_id,id);
alter table public.department_operation_grant_history enable row level security;
revoke all on public.department_operation_grant_history from public,anon,authenticated;
grant all on public.department_operation_grant_history to service_role;
revoke all on sequence public.department_operation_grant_history_id_seq from public,anon,authenticated;
grant usage,select on sequence public.department_operation_grant_history_id_seq to service_role;

create function public.calendar_instance_history(p_schedule uuid,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_dept uuid; v_total integer; v_rows jsonb;
begin
  select department_scope_id into v_dept from public.recurring_schedules where id=p_schedule;
  if not found or not coalesce(activity_private.can_department_operation(v_dept,'calendar'),false) then
    raise exception 'Calendar history is not permitted.' using errcode='42501';
  end if;
  if p_offset is null or p_offset<0 or p_offset>10000 then
    raise exception 'Invalid calendar history offset.' using errcode='22023';
  end if;
  select count(*) into v_total from public.recurring_instances where schedule_id=p_schedule;
  select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'title',t.title,
    'cycleMonday',q.cycle_monday,'startsAt',q.starts_at,'endsAt',q.ends_at,
    'status',q.status,'activityId',q.activity_id,'blackoutId',q.blackout_id,
    'decidedBy',q.decided_by,'decidedAt',q.decided_at,'generatedBy',q.generated_by,
    'recordedAt',q.recorded_at) order by q.starts_at desc,q.id),'[]'::jsonb)
    into v_rows from (
      select * from public.recurring_instances where schedule_id=p_schedule
      order by starts_at desc,id limit 50 offset p_offset
    ) q join public.recurring_schedule_slots t on t.id=q.slot_id;
  return jsonb_build_object('instances',v_rows,'total',v_total,'offset',p_offset,'pageSize',50);
end $$;
revoke all on function public.calendar_instance_history(uuid,integer) from public,anon,authenticated;
grant execute on function public.calendar_instance_history(uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;
