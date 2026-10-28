begin;
-- Additive: the existing cross-Activity overview and its grants remain unchanged.
create function public.supervisory_activity_overview(p_department uuid,
  p_activity uuid default null,p_section uuid default null,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_options jsonb; v_result jsonb;
begin
  if not coalesce(activity_private.can_department_operation(p_department,'supervise'),false) then
    raise exception 'Department supervision is not permitted.' using errcode='42501';
  end if;
  if p_section is not null and not exists(select 1 from public.scopes s
    where s.id=p_section and s.kind='section' and s.parent_id=p_department) then
    raise exception 'Section is outside this department.' using errcode='42501';
  end if;
  if p_offset is null or p_offset<0 or p_offset>10000 then
    raise exception 'Invalid supervision offset.' using errcode='22023';
  end if;
  if p_activity is not null and not activity_private.activity_in_department(p_activity,p_department) then
    raise exception 'Activity is outside this department.' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'title',a.title)
    order by a.created_at desc,a.id),'[]'::jsonb) into v_options
    from public.activities a where activity_private.activity_in_department(a.id,p_department);
  if p_activity is null then return jsonb_build_object('activities',v_options); end if;

  with records as materialized (
    select x.id assignment_id,r.linked_student_id student_id,r.display_name student_name,
      r.external_student_id student_identifier,cm.user_id counselor_id,cm.display_name counselor_name,
      c.state,a.requires_verification
    from public.activity_assignments x
    join public.activities a on a.id=x.activity_id
    join public.department_student_roster r on r.linked_student_id=x.student_id
      and r.department_scope_id=p_department and r.active
    join public.scopes s on s.id=r.section_scope_id and s.kind='section' and s.parent_id=p_department
    join public.profiles sp on sp.id=r.linked_student_id and sp.is_active and sp.account_kind='student'
    left join public.activity_completions c on c.assignment_id=x.id
    left join lateral (
      select cr.user_id,p.display_name from public.counselor_student_mappings m
      join public.responsibility_assignments cr on cr.id=m.counselor_responsibility_id
        and cr.role='counselor' and cr.starts_at<=now() and (cr.ends_at is null or now()<cr.ends_at)
        and cr.scope_id in (r.department_scope_id,r.section_scope_id)
      join public.profiles p on p.id=cr.user_id and p.is_active and p.account_kind='staff'
      where m.roster_student_id=r.id and m.starts_at<=now() and (m.ends_at is null or now()<m.ends_at)
      order by m.starts_at desc,m.id limit 1
    ) cm on true
    where x.activity_id=p_activity and (p_section is null or r.section_scope_id=p_section)
      and exists(select 1 from public.student_scope_memberships sm where sm.student_id=r.linked_student_id
        and sm.scope_id=r.section_scope_id and sm.starts_at<=now() and (sm.ends_at is null or now()<sm.ends_at))
  ), totals as (
    select counselor_id,counselor_name,grouping(counselor_id) is_total,
      count(*) assigned,count(state) reported,
      count(*) filter(where state='reported' and requires_verification) awaiting,
      count(*) filter(where state='verified') verified,
      count(*) filter(where state is null) pending
    from records group by grouping sets ((counselor_id,counselor_name),())
  ), counts as (
    select is_total,counselor_name,counselor_id,jsonb_build_object(
      'counselorId',counselor_id,'name',coalesce(counselor_name,'Unmapped students'),
      'assigned',assigned,'reported',reported,'awaitingVerification',awaiting,
      'verified',verified,'pending',pending,
      'reportedPercent',case when assigned=0 then 0 else round(100.0*reported/assigned,1) end) value
    from totals
  )
  select jsonb_build_object('activities',v_options,'activityId',p_activity,
    'summary',(select value from counts where is_total=1),
    'counselors',coalesce((select jsonb_agg(value order by counselor_name nulls last,counselor_id)
      from counts where is_total=0),'[]'::jsonb),
    'students',coalesce((select jsonb_agg(to_jsonb(q) order by q."studentName",q."studentId") from (
      select student_id "studentId",student_name "studentName",student_identifier "studentIdentifier",
        counselor_name "counselorName",state "completionState",requires_verification "requiresVerification"
      from records order by student_name,student_id limit 50 offset p_offset
    ) q),'[]'::jsonb),'totalStudents',(select count(*) from records),'offset',p_offset,'pageSize',50)
    into v_result;
  return v_result;
end $$;
revoke all on function public.supervisory_activity_overview(uuid,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.supervisory_activity_overview(uuid,uuid,uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;
