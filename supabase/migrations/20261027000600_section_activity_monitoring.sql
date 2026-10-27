begin;

-- Records the audience selection; durable per-student obligations stay in activity_assignments.
create table public.activity_target_sections (
  activity_id uuid not null references public.activities(id) on delete cascade,
  section_scope_id uuid not null references public.scopes(id) on delete restrict,
  primary key(activity_id,section_scope_id)
);
create index activity_target_sections_scope_idx on public.activity_target_sections(section_scope_id,activity_id);
alter table public.activity_target_sections enable row level security;
revoke all on public.activity_target_sections from public,anon,authenticated;
grant all on public.activity_target_sections to service_role;

-- This is deliberately narrower than general scope READ: it covers only the creator's
-- own section-snapshot activity while current CREATE approval still covers every target.
create function activity_private.can_monitor_created(p_activity uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select activity_private.active_kind()='staff' and exists(
    select 1 from public.activities a where a.id=p_activity and a.created_by=auth.uid()
      and exists(select 1 from public.activity_target_sections t where t.activity_id=a.id)
      and not exists(select 1 from public.activity_target_sections t where t.activity_id=a.id
        and not coalesce(activity_private.can_manage(t.section_scope_id,a.category_key,'create'),false))
  )
$$;

-- Existing 3A direct activities retain their exact-scope RLS behavior. Section-snapshot
-- activities have a narrower staff read rule so a department CREATE grant cannot read
-- unrelated section-snapshot activities merely because their scope is the department.
create or replace function activity_private.can_read_activity(p_activity uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.activities a where a.id=p_activity and (
    (activity_private.active_kind()='student' and exists(
      select 1 from public.activity_assignments x where x.activity_id=a.id and x.student_id=auth.uid()))
    or (activity_private.active_kind()='staff' and (
      (not exists(select 1 from public.activity_target_sections t where t.activity_id=a.id)
        and activity_private.can_manage(a.scope_id,a.category_key,'read'))
      or (exists(select 1 from public.activity_target_sections t where t.activity_id=a.id)
        and (activity_private.can_monitor_created(a.id)
          or activity_private.can_manage(a.scope_id,a.category_key,'verify')))
    ))
  ))
$$;
create or replace function activity_private.can_read_assignment(p_assignment uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.activity_assignments x
    join public.activities a on a.id=x.activity_id where x.id=p_assignment and (
      (activity_private.active_kind()='student' and x.student_id=auth.uid())
      or (activity_private.active_kind()='staff' and (
        (not exists(select 1 from public.activity_target_sections t where t.activity_id=a.id)
          and activity_private.can_manage(a.scope_id,a.category_key,'read'))
        or (exists(select 1 from public.activity_target_sections t where t.activity_id=a.id)
          and (activity_private.can_monitor_created(a.id)
            or activity_private.can_manage(a.scope_id,a.category_key,'verify')))
      ))
    ))
$$;
drop policy history_visible on public.activity_history;
create policy history_visible on public.activity_history for select to authenticated
  using (case when assignment_id is not null then activity_private.can_read_assignment(assignment_id)
    else activity_private.active_kind()='staff' and activity_private.can_read_activity(activity_id) end);

create function public.create_section_activity(
  p_category text,p_department uuid,p_sections uuid[],p_title text,p_description text,
  p_starts_at timestamptz,p_deadline_at timestamptz,p_ends_at timestamptz,
  p_requires_verification boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_activity uuid; v_scope uuid; v_assigned integer;
  v_roster integer; v_unlinked integer; v_inactive integer; v_no_membership integer;
begin
  if p_sections is null or cardinality(p_sections) not between 1 and 20
    or array_ndims(p_sections)<>1 or array_position(p_sections,null) is not null
    or cardinality(p_sections)<>(select count(distinct x) from unnest(p_sections) x)
    or not exists(select 1 from public.scopes d where d.id=p_department and d.kind='department')
    or exists(select 1 from unnest(p_sections) x where not exists(
      select 1 from public.scopes s where s.id=x and s.kind='section' and s.parent_id=p_department)) then
    raise exception 'Invalid department or section selection.' using errcode='22023';
  end if;
  if exists(select 1 from unnest(p_sections) x where not coalesce(
    activity_private.can_manage(x,p_category,'create'),false)) then
    raise exception 'Section Activity creation is not permitted.' using errcode='42501';
  end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 160
    or p_description is null or char_length(p_description)>5000
    or p_requires_verification is null or p_starts_at is null or p_deadline_at is null or p_ends_at is null
    or not isfinite(p_starts_at) or not isfinite(p_deadline_at) or not isfinite(p_ends_at)
    or not (p_starts_at<p_deadline_at and p_deadline_at<=p_ends_at and now()<p_deadline_at) then
    raise exception 'Invalid Activity fields or dates.' using errcode='22023';
  end if;
  v_scope:=case when cardinality(p_sections)=1 then p_sections[1] else p_department end;
  insert into public.activities(category_key,scope_id,title,description,starts_at,deadline_at,
    ends_at,requires_verification,created_by)
    values(p_category,v_scope,btrim(p_title),p_description,p_starts_at,p_deadline_at,
      p_ends_at,p_requires_verification,v_actor) returning id into v_activity;
  insert into public.activity_target_sections(activity_id,section_scope_id)
    select v_activity,x from unnest(p_sections) x;
  -- One INSERT statement supplies the eligible-student snapshot. Profile/roster or
  -- membership changes after this statement do not rewrite existing assignments.
  with roster as materialized (
    select r.id,r.linked_student_id,r.active,
      (p.id is not null and p.is_active and p.account_kind='student') as provisioned,
      exists(select 1 from public.student_scope_memberships m
        where m.student_id=r.linked_student_id and m.scope_id=r.section_scope_id
          and m.starts_at<=now() and (m.ends_at is null or now()<m.ends_at)) as member
    from public.department_student_roster r left join public.profiles p on p.id=r.linked_student_id
    where r.department_scope_id=p_department and r.section_scope_id=any(p_sections)
  ), inserted as (
    insert into public.activity_assignments(activity_id,student_id,assigned_by)
      select v_activity,linked_student_id,v_actor from roster
      where active and linked_student_id is not null and provisioned and member
      returning student_id
  )
  select (select count(*) from inserted),(select count(*) from roster),
    (select count(*) from roster where active and linked_student_id is null),
    (select count(*) from roster where not active or (linked_student_id is not null and not provisioned)),
    (select count(*) from roster where active and linked_student_id is not null and provisioned and not member)
    into v_assigned,v_roster,v_unlinked,v_inactive,v_no_membership;
  if v_assigned=0 then
    raise exception 'No eligible provisioned students in selected sections.' using errcode='22023';
  end if;
  insert into public.activity_history(activity_id,actor_id,action) values(v_activity,v_actor,'created');
  insert into public.activity_history(activity_id,assignment_id,actor_id,action)
    select v_activity,id,v_actor,'assigned' from public.activity_assignments where activity_id=v_activity;
  return jsonb_build_object('id',v_activity,'assignedCount',v_assigned,'rosterRows',v_roster,
    'unlinkedRows',v_unlinked,'inactiveRows',v_inactive,'missingMembershipRows',v_no_membership);
end $$;

create function public.monitor_created_activity(p_activity uuid,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_activity public.activities; v_total integer; v_self integer; v_awaiting integer;
  v_verified integer; v_pending integer; v_overdue integer; v_rows jsonb;
begin
  if p_offset is null or p_offset<0 or p_offset>10000 then
    raise exception 'Invalid monitoring offset.' using errcode='22023';
  end if;
  select * into v_activity from public.activities where id=p_activity;
  if not found or activity_private.active_kind()<>'staff' or v_activity.created_by<>auth.uid()
    or (exists(select 1 from public.activity_target_sections t where t.activity_id=p_activity)
      and not activity_private.can_monitor_created(p_activity))
    or (not exists(select 1 from public.activity_target_sections t where t.activity_id=p_activity)
      and not coalesce(activity_private.can_manage(v_activity.scope_id,v_activity.category_key,'read'),false)) then
    raise exception 'Activity monitoring is not permitted.' using errcode='42501';
  end if;
  select count(*)::integer,
    count(*) filter(where c.state='reported' and not v_activity.requires_verification)::integer,
    count(*) filter(where c.state='reported' and v_activity.requires_verification)::integer,
    count(*) filter(where c.state='verified')::integer,
    count(*) filter(where c.assignment_id is null and now()<v_activity.deadline_at)::integer,
    count(*) filter(where c.assignment_id is null and now()>=v_activity.deadline_at)::integer
    into v_total,v_self,v_awaiting,v_verified,v_pending,v_overdue
    from public.activity_assignments x left join public.activity_completions c on c.assignment_id=x.id
    where x.activity_id=p_activity;
  select coalesce(jsonb_agg(jsonb_build_object('assignmentId',q.id,'studentId',q.student_id,
      'studentIdentifier',q.external_student_id,'studentName',q.display_name,
      'state',q.state,'submittedAt',q.submitted_at,'verifiedAt',q.verified_at)
      order by q.id),'[]'::jsonb) into v_rows from (
    select x.id,x.student_id,r.external_student_id,r.display_name,c.state,c.submitted_at,c.verified_at
    from public.activity_assignments x
    left join public.activity_completions c on c.assignment_id=x.id
    left join public.department_student_roster r on r.linked_student_id=x.student_id
    where x.activity_id=p_activity order by x.id limit 50 offset p_offset
  ) q;
  return jsonb_build_object('activityId',p_activity,'totalAssigned',v_total,
    'selfReportedCompleted',v_self,'awaitingVerification',v_awaiting,
    'verified',v_verified,'pending',v_pending,'overdue',v_overdue,
    'assignments',v_rows,'offset',p_offset,'pageSize',50);
end $$;

create function public.monitor_counselor_activities(p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_total integer; v_rows jsonb;
begin
  if p_offset is null or p_offset<0 or p_offset>10000 then
    raise exception 'Invalid monitoring offset.' using errcode='22023';
  end if;
  if activity_private.active_kind()<>'staff' then
    raise exception 'Counselor monitoring is not permitted.' using errcode='42501';
  end if;
  with visible as (
    select x.id from public.activity_assignments x
    join public.department_student_roster s on s.linked_student_id=x.student_id and s.active
    join public.profiles p on p.id=x.student_id and p.is_active and p.account_kind='student'
    join public.counselor_student_mappings m on m.roster_student_id=s.id
    join public.responsibility_assignments r on r.id=m.counselor_responsibility_id
    where r.user_id=auth.uid() and r.role='counselor'
      and r.starts_at<=now() and (r.ends_at is null or now()<r.ends_at)
      and m.starts_at<=now() and (m.ends_at is null or now()<m.ends_at)
  ) select count(*)::integer into v_total from visible;
  select coalesce(jsonb_agg(jsonb_build_object('assignmentId',q.assignment_id,
    'activityId',q.activity_id,'title',q.title,'category',q.category_key,
    'deadlineAt',q.deadline_at,'requiresVerification',q.requires_verification,
    'studentId',q.student_id,'studentIdentifier',q.external_student_id,
    'studentName',q.display_name,'state',q.state,'submittedAt',q.submitted_at,
    'verifiedAt',q.verified_at) order by q.deadline_at desc,q.assignment_id),'[]'::jsonb)
    into v_rows from (
    select x.id assignment_id,a.id activity_id,a.title,a.category_key,a.deadline_at,
      a.requires_verification,x.student_id,s.external_student_id,s.display_name,
      c.state,c.submitted_at,c.verified_at
    from public.activity_assignments x join public.activities a on a.id=x.activity_id
    join public.department_student_roster s on s.linked_student_id=x.student_id and s.active
    join public.profiles p on p.id=x.student_id and p.is_active and p.account_kind='student'
    join public.counselor_student_mappings m on m.roster_student_id=s.id
    join public.responsibility_assignments r on r.id=m.counselor_responsibility_id
    left join public.activity_completions c on c.assignment_id=x.id
    where r.user_id=auth.uid() and r.role='counselor'
      and r.starts_at<=now() and (r.ends_at is null or now()<r.ends_at)
      and m.starts_at<=now() and (m.ends_at is null or now()<m.ends_at)
    order by a.deadline_at desc,x.id limit 50 offset p_offset
  ) q;
  return jsonb_build_object('total',v_total,'assignments',v_rows,'offset',p_offset,'pageSize',50);
end $$;

revoke all on function activity_private.can_monitor_created(uuid) from public,anon,authenticated;
grant execute on function activity_private.can_monitor_created(uuid) to authenticated;
revoke all on function public.create_section_activity(text,uuid,uuid[],text,text,timestamptz,timestamptz,timestamptz,boolean),
  public.monitor_created_activity(uuid,integer),public.monitor_counselor_activities(integer)
  from public,anon,authenticated;
grant execute on function public.create_section_activity(text,uuid,uuid[],text,text,timestamptz,timestamptz,timestamptz,boolean),
  public.monitor_created_activity(uuid,integer),public.monitor_counselor_activities(integer) to authenticated;
notify pgrst,'reload schema';
commit;
