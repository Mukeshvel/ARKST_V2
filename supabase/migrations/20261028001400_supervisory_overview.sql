begin;

-- A separate trusted SUPERVISE grant permits private department drill-down.
-- Activity CREATE, directory preferences and role/designation text never imply it.
create function public.supervisory_overview(p_department uuid,p_section uuid default null,
  p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_sections jsonb; v_counselors jsonb; v_students jsonb; v_summary jsonb;
  v_total integer;
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
  with eligible as (
    select r.id,r.linked_student_id,r.section_scope_id,r.display_name,r.external_student_id
    from public.department_student_roster r
    join public.profiles p on p.id=r.linked_student_id and p.account_kind='student' and p.is_active
    where r.department_scope_id=p_department and r.active
      and (p_section is null or r.section_scope_id=p_section)
      and exists(select 1 from public.student_scope_memberships m
        where m.student_id=r.linked_student_id and m.scope_id=r.section_scope_id
          and m.starts_at<=now() and (m.ends_at is null or now()<m.ends_at))
  ), cases as (
    select e.section_scope_id,x.id assignment_id,a.deadline_at,a.requires_verification,c.state,
      exists(select 1 from public.activity_follow_ups f where f.assignment_id=x.id and f.status='open') follow_up,
      exists(select 1 from public.activity_escalations z where z.assignment_id=x.id and z.status='open') escalation
    from eligible e join public.activity_assignments x on x.student_id=e.linked_student_id
      join public.activities a on a.id=x.activity_id
      left join public.activity_completions c on c.assignment_id=x.id
  )
  select jsonb_build_object('activeStudents',(select count(*) from eligible),
    'assignments',(select count(*) from cases),
    'reported',(select count(*) from cases where state='reported' and not requires_verification),
    'awaitingVerification',(select count(*) from cases where state='reported' and requires_verification),
    'verified',(select count(*) from cases where state='verified'),
    'pending',(select count(*) from cases where state is null and deadline_at>now()),
    'overdue',(select count(*) from cases where state is null and deadline_at<=now()),
    'openFollowUps',(select count(*) from cases where follow_up),
    'openEscalations',(select count(*) from cases where escalation)) into v_summary;

  select coalesce(jsonb_agg(jsonb_build_object('sectionId',s.id,'sectionName',s.name,
    'activeStudents',(select count(*) from public.department_student_roster r
      join public.profiles p on p.id=r.linked_student_id and p.is_active and p.account_kind='student'
      where r.section_scope_id=s.id and r.department_scope_id=p_department and r.active
        and exists(select 1 from public.student_scope_memberships m
          where m.student_id=r.linked_student_id and m.scope_id=s.id and m.starts_at<=now()
            and (m.ends_at is null or now()<m.ends_at))),
    'assignments',(select count(*) from public.department_student_roster r
      join public.profiles p on p.id=r.linked_student_id and p.is_active and p.account_kind='student'
      join public.activity_assignments x on x.student_id=r.linked_student_id
      where r.section_scope_id=s.id and r.department_scope_id=p_department and r.active
        and exists(select 1 from public.student_scope_memberships m where m.student_id=r.linked_student_id
          and m.scope_id=s.id and m.starts_at<=now() and (m.ends_at is null or now()<m.ends_at))),
    'completed',(select count(*) from public.department_student_roster r
      join public.profiles p on p.id=r.linked_student_id and p.is_active and p.account_kind='student'
      join public.activity_assignments x on x.student_id=r.linked_student_id
      join public.activity_completions c on c.assignment_id=x.id
      where r.section_scope_id=s.id and r.department_scope_id=p_department and r.active
        and exists(select 1 from public.student_scope_memberships m where m.student_id=r.linked_student_id
          and m.scope_id=s.id and m.starts_at<=now() and (m.ends_at is null or now()<m.ends_at))))
    order by s.name,s.id),'[]'::jsonb) into v_sections
    from public.scopes s where s.kind='section' and s.parent_id=p_department
      and (p_section is null or s.id=p_section);

  select coalesce(jsonb_agg(jsonb_build_object('counselorId',q.user_id,'name',q.display_name,
    'studentCount',q.students,'assignments',q.assignments,'completed',q.completed)
    order by q.display_name,q.user_id),'[]'::jsonb) into v_counselors from (
    select cr.user_id,p.display_name,count(distinct r.id) students,
      count(x.id) assignments,count(c.assignment_id) completed
    from public.counselor_student_mappings m
    join public.responsibility_assignments cr on cr.id=m.counselor_responsibility_id
      and cr.role='counselor' and cr.starts_at<=now() and (cr.ends_at is null or now()<cr.ends_at)
    join public.profiles p on p.id=cr.user_id and p.is_active and p.account_kind='staff'
    join public.department_student_roster r on r.id=m.roster_student_id and r.active
      and r.department_scope_id=p_department
    join public.profiles sp on sp.id=r.linked_student_id and sp.is_active and sp.account_kind='student'
    left join public.activity_assignments x on x.student_id=r.linked_student_id
    left join public.activity_completions c on c.assignment_id=x.id
    where m.starts_at<=now() and (m.ends_at is null or now()<m.ends_at)
      and (p_section is null or r.section_scope_id=p_section)
      and exists(select 1 from public.student_scope_memberships sm where sm.student_id=r.linked_student_id
        and sm.scope_id=r.section_scope_id and sm.starts_at<=now() and (sm.ends_at is null or now()<sm.ends_at))
    group by cr.user_id,p.display_name
  ) q;

  select count(*) into v_total from public.department_student_roster r
    join public.profiles p on p.id=r.linked_student_id and p.is_active and p.account_kind='student'
    where r.department_scope_id=p_department and r.active
      and (p_section is null or r.section_scope_id=p_section)
      and exists(select 1 from public.student_scope_memberships m where m.student_id=r.linked_student_id
        and m.scope_id=r.section_scope_id and m.starts_at<=now() and (m.ends_at is null or now()<m.ends_at));
  select coalesce(jsonb_agg(jsonb_build_object('studentId',q.linked_student_id,
    'studentName',q.display_name,'studentIdentifier',q.external_student_id,
    'sectionId',q.section_scope_id,'sectionName',q.section_name,
    'counselorName',q.counselor_name,'assignments',q.assignments,
    'completed',q.completed,'pending',q.pending,'overdue',q.overdue,
    'openFollowUps',q.follow_ups,'openEscalations',q.escalations)
    order by q.display_name,q.external_student_id),'[]'::jsonb) into v_students from (
    select r.*,s.name section_name,
      (select p.display_name from public.counselor_student_mappings m
        join public.responsibility_assignments cr on cr.id=m.counselor_responsibility_id
        join public.profiles p on p.id=cr.user_id and p.is_active
        where m.roster_student_id=r.id and m.starts_at<=now() and (m.ends_at is null or now()<m.ends_at)
          and cr.starts_at<=now() and (cr.ends_at is null or now()<cr.ends_at)
        order by m.starts_at desc limit 1) counselor_name,
      (select count(*) from public.activity_assignments x where x.student_id=r.linked_student_id) assignments,
      (select count(*) from public.activity_assignments x join public.activity_completions c on c.assignment_id=x.id
        where x.student_id=r.linked_student_id) completed,
      (select count(*) from public.activity_assignments x join public.activities a on a.id=x.activity_id
        left join public.activity_completions c on c.assignment_id=x.id
        where x.student_id=r.linked_student_id and c.assignment_id is null and a.deadline_at>now()) pending,
      (select count(*) from public.activity_assignments x join public.activities a on a.id=x.activity_id
        left join public.activity_completions c on c.assignment_id=x.id
        where x.student_id=r.linked_student_id and c.assignment_id is null and a.deadline_at<=now()) overdue,
      (select count(*) from public.activity_follow_ups f join public.activity_assignments x on x.id=f.assignment_id
        where x.student_id=r.linked_student_id and f.status='open') follow_ups,
      (select count(*) from public.activity_escalations e join public.activity_assignments x on x.id=e.assignment_id
        where x.student_id=r.linked_student_id and e.status='open') escalations
    from public.department_student_roster r
    join public.profiles p on p.id=r.linked_student_id and p.is_active and p.account_kind='student'
    join public.scopes s on s.id=r.section_scope_id and s.kind='section' and s.parent_id=p_department
    where r.department_scope_id=p_department and r.active
      and (p_section is null or r.section_scope_id=p_section)
      and exists(select 1 from public.student_scope_memberships m where m.student_id=r.linked_student_id
        and m.scope_id=r.section_scope_id and m.starts_at<=now() and (m.ends_at is null or now()<m.ends_at))
    order by r.display_name,r.external_student_id limit 50 offset p_offset
  ) q;
  return jsonb_build_object('summary',v_summary,'sections',v_sections,'counselors',v_counselors,
    'students',v_students,'totalStudents',v_total,'offset',p_offset,'pageSize',50);
end $$;
revoke all on function public.supervisory_overview(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.supervisory_overview(uuid,uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;
