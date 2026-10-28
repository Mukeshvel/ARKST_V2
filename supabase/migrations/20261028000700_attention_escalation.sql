begin;

create function public.attention_needed(p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_total integer; v_rows jsonb;
begin
  if activity_private.active_kind()<>'staff' or p_offset is null or p_offset<0 or p_offset>10000 then
    raise exception 'Attention view is unavailable.' using errcode='42501';
  end if;
  with eligible as (
    select x.id assignment_id,x.student_id,a.id activity_id,a.title,a.deadline_at,
      r.display_name,r.external_student_id,
      exists(select 1 from public.activity_follow_ups f where f.assignment_id=x.id and f.status='open') has_follow_up,
      exists(select 1 from public.catch_up_requests c where c.student_id=x.student_id
        and c.status in ('submitted','approved') and activity_private.can_view_catch_up(c.id)) has_catch_up
    from public.activity_assignments x
    join public.activities a on a.id=x.activity_id and a.starts_at<=now()
    join public.department_student_roster r on r.linked_student_id=x.student_id and r.active
    where not exists(select 1 from public.activity_completions c where c.assignment_id=x.id)
      and activity_private.can_follow_up_assignment(x.id)
  ), tagged as (
    select e.*,count(*) over(partition by student_id) outstanding_count
    from eligible e
  ), noteworthy as (
    select t.* from tagged t where t.deadline_at<=now()+interval '48 hours'
      or t.outstanding_count>=2 or t.has_follow_up or t.has_catch_up
  ) select count(*) into v_total from noteworthy;
  with eligible as (
    select x.id assignment_id,x.student_id,a.id activity_id,a.title,a.deadline_at,
      r.display_name,r.external_student_id,
      exists(select 1 from public.activity_follow_ups f where f.assignment_id=x.id and f.status='open') has_follow_up,
      exists(select 1 from public.catch_up_requests c where c.student_id=x.student_id
        and c.status in ('submitted','approved') and activity_private.can_view_catch_up(c.id)) has_catch_up
    from public.activity_assignments x
    join public.activities a on a.id=x.activity_id and a.starts_at<=now()
    join public.department_student_roster r on r.linked_student_id=x.student_id and r.active
    where not exists(select 1 from public.activity_completions c where c.assignment_id=x.id)
      and activity_private.can_follow_up_assignment(x.id)
  ), tagged as (
    select e.*,count(*) over(partition by student_id) outstanding_count
    from eligible e
  ), noteworthy as (
    select t.* from tagged t where t.deadline_at<=now()+interval '48 hours'
      or t.outstanding_count>=2 or t.has_follow_up or t.has_catch_up
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'assignmentId',q.assignment_id,'activityId',q.activity_id,'title',q.title,
    'deadlineAt',q.deadline_at,'studentName',q.display_name,
    'studentIdentifier',q.external_student_id,'outstandingCount',q.outstanding_count,
    'reasons',to_jsonb(array_remove(array[
      case when q.deadline_at<=now() then 'Overdue Activity' end,
      case when q.deadline_at>now() and q.deadline_at<=now()+interval '48 hours' then 'Deadline within 48 hours' end,
      case when q.outstanding_count>=2 then 'Multiple outstanding Activities' end,
      case when q.has_follow_up then 'Unresolved follow-up' end,
      case when q.has_catch_up then 'Missed academic information request' end
    ],null))
  ) order by q.deadline_at,q.assignment_id),'[]'::jsonb) into v_rows from (
    select * from noteworthy order by deadline_at,assignment_id limit 50 offset p_offset
  ) q;
  return jsonb_build_object('items',v_rows,'total',v_total,'offset',p_offset,'pageSize',50);
end $$;

-- A trusted administrator configures one current coordinator and one branch
-- coordinator/HOD route per section. No title or self-edited profile can route.
create table public.escalation_routes (
  id uuid primary key default gen_random_uuid(),
  section_scope_id uuid not null references public.scopes(id) on delete restrict,
  target_role text not null check(target_role in ('coordinator','branch_coordinator','hod')),
  responsibility_id uuid not null references public.responsibility_assignments(id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(section_scope_id,target_role,responsibility_id)
);
create unique index one_current_escalation_route on public.escalation_routes(section_scope_id,target_role)
  where active;
create function activity_private.validate_escalation_route() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.scopes section
    join public.responsibility_assignments r on r.id=new.responsibility_id
    join public.scopes granted on granted.id=r.scope_id
    join public.profiles p on p.id=r.user_id and p.account_kind='staff'
    where section.id=new.section_scope_id and section.kind='section'
      and r.role=new.target_role and granted.kind in ('department','section')
      and (granted.id=section.id or granted.id=section.parent_id)) then
    raise exception 'Route must name a matching responsibility in this section or department.' using errcode='23514';
  end if;
  return new;
end $$;
create trigger escalation_route_validate before insert or update on public.escalation_routes
  for each row execute function activity_private.validate_escalation_route();

create table public.activity_escalations (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.activity_assignments(id) on delete restrict,
  initiated_by uuid not null references public.profiles(id) on delete restrict,
  recipient_id uuid not null references public.profiles(id) on delete restrict,
  recipient_responsibility_id uuid not null references public.responsibility_assignments(id) on delete restrict,
  stage text not null check(stage in ('counselor','coordinator','branch_coordinator','hod')),
  reason text not null check(char_length(btrim(reason)) between 1 and 500),
  status text not null default 'open' check(status in ('open','advanced','resolved')),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references public.profiles(id) on delete restrict,
  resolution_note text check(resolution_note is null or char_length(btrim(resolution_note)) between 1 and 500),
  check((status='open' and closed_at is null and closed_by is null)
    or (status<>'open' and closed_at is not null and closed_by is not null))
);
create unique index one_open_escalation_per_assignment on public.activity_escalations(assignment_id) where status='open';
create index activity_escalation_assignment_time on public.activity_escalations(assignment_id,created_at desc);
create index activity_escalation_recipient_time on public.activity_escalations(recipient_id,created_at desc);
create table public.activity_escalation_history (
  id bigint generated always as identity primary key,
  escalation_id uuid not null references public.activity_escalations(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check(action in ('opened','advanced','resolved','student_reported')),
  occurred_at timestamptz not null default now(),
  note text
);
create index activity_escalation_history_case on public.activity_escalation_history(escalation_id,id);

create function activity_private.current_escalation_recipient(p_escalation uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select activity_private.active_kind()='staff' and exists(
    select 1 from public.activity_escalations e
    join public.responsibility_assignments r on r.id=e.recipient_responsibility_id
      and r.user_id=e.recipient_id and r.role=e.stage
    where e.id=p_escalation and e.recipient_id=auth.uid()
      and r.starts_at<=now() and (r.ends_at is null or now()<r.ends_at))
$$;
create function activity_private.can_view_escalation(p_escalation uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.activity_escalations e
    join public.activity_assignments x on x.id=e.assignment_id
    where e.id=p_escalation and (
      (activity_private.active_kind()='student' and x.student_id=auth.uid())
      or activity_private.current_escalation_recipient(e.id)
      or (e.initiated_by=auth.uid() and activity_private.can_follow_up_assignment(e.assignment_id))))
$$;
alter table public.escalation_routes enable row level security;
alter table public.activity_escalations enable row level security;
alter table public.activity_escalation_history enable row level security;
revoke all on public.escalation_routes,public.activity_escalations,public.activity_escalation_history from public,anon,authenticated;
grant select on public.activity_escalations,public.activity_escalation_history to authenticated;
grant all on public.escalation_routes,public.activity_escalations,public.activity_escalation_history to service_role;
revoke all on sequence public.activity_escalation_history_id_seq from public,anon,authenticated;
grant usage,select on sequence public.activity_escalation_history_id_seq to service_role;
create policy escalation_scoped_read on public.activity_escalations for select to authenticated
  using(activity_private.can_view_escalation(id));
create policy escalation_history_scoped_read on public.activity_escalation_history for select to authenticated
  using(activity_private.can_view_escalation(escalation_id));

create function public.escalate_activity(p_assignment uuid,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_assignment public.activity_assignments; v_roster public.department_student_roster;
  v_open public.activity_escalations; v_role text; v_resp uuid; v_recipient uuid;
  v_id uuid; v_stage text;
begin
  if p_reason is null or char_length(btrim(p_reason)) not between 1 and 500 then
    raise exception 'Escalation reason is required.' using errcode='22023';
  end if;
  select * into v_assignment from public.activity_assignments where id=p_assignment for update;
  if not found then raise exception 'Assignment is unavailable.' using errcode='42501'; end if;
  select * into v_roster from public.department_student_roster
    where linked_student_id=v_assignment.student_id and active;
  if not found or exists(select 1 from public.activity_completions where assignment_id=p_assignment) then
    raise exception 'Only current pending assignments can be escalated.' using errcode='42501';
  end if;
  select * into v_open from public.activity_escalations
    where assignment_id=p_assignment and status='open' for update;
  if activity_private.active_kind()='student' and v_assignment.student_id=auth.uid() then
    if v_open.id is not null then raise exception 'Escalation is already open.' using errcode='23505'; end if;
    select r.id,r.user_id into v_resp,v_recipient from public.counselor_student_mappings m
      join public.responsibility_assignments r on r.id=m.counselor_responsibility_id
      join public.profiles p on p.id=r.user_id and p.is_active and p.account_kind='staff'
      where m.roster_student_id=v_roster.id and r.role='counselor'
        and m.starts_at<=now() and (m.ends_at is null or now()<m.ends_at)
        and r.starts_at<=now() and (r.ends_at is null or now()<r.ends_at);
    if v_resp is null then raise exception 'No current counselor route is configured.' using errcode='22023'; end if;
    v_stage:='counselor';
  elsif activity_private.active_kind()='staff' and activity_private.can_see_roster(v_roster.id)
      and activity_private.can_follow_up_assignment(p_assignment) then
    if v_open.id is not null and v_open.stage<>'counselor' then
      raise exception 'Escalation is already at a higher stage.' using errcode='23505';
    end if;
    if v_open.id is not null and v_open.recipient_id<>auth.uid() then
      raise exception 'This escalation belongs to another counselor.' using errcode='42501';
    end if;
    v_stage:='coordinator';
  elsif activity_private.active_kind()='staff' and v_open.id is not null
      and v_open.stage='coordinator' and activity_private.current_escalation_recipient(v_open.id) then
    v_stage:='branch_coordinator';
  else
    raise exception 'Escalation is outside your current responsibility.' using errcode='42501';
  end if;
  if v_stage<>'counselor' then
    if v_stage='coordinator' then v_role:='coordinator';
    else v_role:='branch_coordinator'; end if;
    select r.id,r.user_id into v_resp,v_recipient from public.escalation_routes route
      join public.responsibility_assignments r on r.id=route.responsibility_id and r.role=route.target_role
      join public.profiles p on p.id=r.user_id and p.account_kind='staff' and p.is_active
      where route.section_scope_id=v_roster.section_scope_id and route.active
        and route.target_role=v_role and r.starts_at<=now() and (r.ends_at is null or now()<r.ends_at)
      for share of route,r;
    if v_resp is null and v_stage='branch_coordinator' then
      v_stage:='hod';
      select r.id,r.user_id into v_resp,v_recipient from public.escalation_routes route
        join public.responsibility_assignments r on r.id=route.responsibility_id and r.role='hod'
        join public.profiles p on p.id=r.user_id and p.account_kind='staff' and p.is_active
        where route.section_scope_id=v_roster.section_scope_id and route.active
          and route.target_role='hod' and r.starts_at<=now() and (r.ends_at is null or now()<r.ends_at)
        for share of route,r;
    end if;
    if v_resp is null then raise exception 'No current escalation route is configured.' using errcode='22023'; end if;
  end if;
  if exists(select 1 from public.activity_escalations e where e.assignment_id=p_assignment
    and e.stage=v_stage and e.created_at>now()-interval '24 hours') then
    raise exception 'This escalation stage was already notified recently.' using errcode='23505';
  end if;
  if v_open.id is not null then
    update public.activity_escalations set status='advanced',closed_at=now(),closed_by=auth.uid()
      where id=v_open.id;
    insert into public.activity_escalation_history(escalation_id,actor_id,action,note)
      values(v_open.id,auth.uid(),'advanced',btrim(p_reason));
  end if;
  insert into public.activity_escalations(assignment_id,initiated_by,recipient_id,
    recipient_responsibility_id,stage,reason)
    values(p_assignment,auth.uid(),v_recipient,v_resp,v_stage,btrim(p_reason)) returning id into v_id;
  insert into public.activity_escalation_history(escalation_id,actor_id,action,note)
    values(v_id,auth.uid(),'opened',btrim(p_reason));
  insert into public.notifications(recipient_id,source_kind,source_id,title,message,target_path)
    values(v_recipient,'escalation',v_id,'Activity escalation',
      'An Activity requires your attention in ARKST.','/dashboard/attention');
  return jsonb_build_object('id',v_id,'stage',v_stage,'recipientId',v_recipient);
end $$;

create function public.resolve_activity_escalation(p_escalation uuid,p_note text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_row public.activity_escalations;
begin
  if p_note is null or char_length(btrim(p_note)) not between 1 and 500 then
    raise exception 'A resolution note is required.' using errcode='22023';
  end if;
  select * into v_row from public.activity_escalations where id=p_escalation for update;
  if not found or not coalesce(activity_private.current_escalation_recipient(p_escalation),false) then
    raise exception 'Escalation cannot be resolved by this account.' using errcode='42501';
  end if;
  if v_row.status<>'open' then raise exception 'Escalation was already closed.' using errcode='23505'; end if;
  update public.activity_escalations set status='resolved',closed_at=now(),
    closed_by=auth.uid(),resolution_note=btrim(p_note) where id=p_escalation;
  insert into public.activity_escalation_history(escalation_id,actor_id,action,note)
    values(p_escalation,auth.uid(),'resolved',btrim(p_note));
  return jsonb_build_object('id',p_escalation,'status','resolved');
end $$;

create function activity_private.resolve_escalation_on_report() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  for v_id in update public.activity_escalations
    set status='resolved',closed_at=now(),closed_by=new.submitted_by,
      resolution_note='Student reported completion'
    where assignment_id=new.assignment_id and status='open' returning id loop
    insert into public.activity_escalation_history(escalation_id,actor_id,action)
      values(v_id,new.submitted_by,'student_reported');
  end loop;
  return new;
end $$;
create trigger activity_completion_resolve_escalation after insert on public.activity_completions
  for each row execute function activity_private.resolve_escalation_on_report();

create function public.list_activity_escalations(p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_total integer; v_rows jsonb;
begin
  if activity_private.active_kind() is null or p_offset is null or p_offset<0 or p_offset>10000 then
    raise exception 'Invalid escalation listing.' using errcode='22023';
  end if;
  select count(*) into v_total from public.activity_escalations e
    where activity_private.can_view_escalation(e.id);
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'assignmentId',q.assignment_id,'activityId',q.activity_id,
    'activityTitle',q.title,'studentName',q.display_name,
    'studentIdentifier',q.external_student_id,'stage',q.stage,
    'reason',q.reason,'status',q.status,'createdAt',q.created_at,
    'closedAt',q.closed_at,'resolutionNote',q.resolution_note,
    'isRecipient',activity_private.current_escalation_recipient(q.id),
    'history',(select coalesce(jsonb_agg(jsonb_build_object('action',h.action,
      'occurredAt',h.occurred_at,'note',h.note) order by h.id),'[]'::jsonb)
      from public.activity_escalation_history h where h.escalation_id=q.id)
  ) order by q.created_at desc,q.id),'[]'::jsonb) into v_rows from (
    select e.*,a.id activity_id,a.title,r.display_name,r.external_student_id
    from public.activity_escalations e
    join public.activity_assignments x on x.id=e.assignment_id
    join public.activities a on a.id=x.activity_id
    join public.department_student_roster r on r.linked_student_id=x.student_id
    where activity_private.can_view_escalation(e.id)
    order by e.created_at desc,e.id limit 50 offset p_offset
  ) q;
  return jsonb_build_object('escalations',v_rows,'total',v_total,'offset',p_offset,'pageSize',50);
end $$;

revoke all on function activity_private.validate_escalation_route(),
  activity_private.current_escalation_recipient(uuid),activity_private.can_view_escalation(uuid),
  activity_private.resolve_escalation_on_report() from public,anon,authenticated;
revoke all on function public.attention_needed(integer),public.escalate_activity(uuid,text),
  public.resolve_activity_escalation(uuid,text),public.list_activity_escalations(integer)
  from public,anon,authenticated;
grant execute on function public.attention_needed(integer),public.escalate_activity(uuid,text),
  public.resolve_activity_escalation(uuid,text),public.list_activity_escalations(integer)
  to authenticated;
notify pgrst,'reload schema';
commit;
