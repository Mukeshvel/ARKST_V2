begin;

create function public.counselor_activity_summaries(p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_total integer; v_rows jsonb;
begin
  if p_offset is null or p_offset<0 or p_offset>10000
    or activity_private.active_kind()<>'staff' then
    raise exception 'Counselor summaries are unavailable.' using errcode='42501';
  end if;
  with visible as (
    select x.id assignment_id,a.id activity_id,a.title,a.deadline_at,a.requires_verification,
      c.state from public.activity_assignments x
    join public.activities a on a.id=x.activity_id
    join public.department_student_roster s on s.linked_student_id=x.student_id and s.active
    join public.profiles p on p.id=x.student_id and p.is_active and p.account_kind='student'
    join public.counselor_student_mappings m on m.roster_student_id=s.id
    join public.responsibility_assignments r on r.id=m.counselor_responsibility_id
    left join public.activity_completions c on c.assignment_id=x.id
    where r.user_id=auth.uid() and r.role='counselor'
      and r.starts_at<=now() and (r.ends_at is null or now()<r.ends_at)
      and m.starts_at<=now() and (m.ends_at is null or now()<m.ends_at)
  ), grouped as (
    select activity_id,title,deadline_at,
      count(*)::integer total_assigned,
      count(*) filter(where state='reported' and not requires_verification)::integer self_reported,
      count(*) filter(where state='reported' and requires_verification)::integer awaiting,
      count(*) filter(where state='verified')::integer verified,
      count(*) filter(where state is null and now()<deadline_at)::integer pending,
      count(*) filter(where state is null and now()>=deadline_at)::integer overdue
    from visible group by activity_id,title,deadline_at
  ) select count(*)::integer into v_total from grouped;
  select coalesce(jsonb_agg(jsonb_build_object('activityId',q.activity_id,
    'title',q.title,'deadlineAt',q.deadline_at,'totalAssigned',q.total_assigned,
    'selfReportedCompleted',q.self_reported,'awaitingVerification',q.awaiting,
    'verified',q.verified,'pending',q.pending,'overdue',q.overdue)
    order by q.deadline_at desc,q.activity_id),'[]'::jsonb) into v_rows from (
    select a.id activity_id,a.title,a.deadline_at,
      count(*)::integer total_assigned,
      count(*) filter(where c.state='reported' and not a.requires_verification)::integer self_reported,
      count(*) filter(where c.state='reported' and a.requires_verification)::integer awaiting,
      count(*) filter(where c.state='verified')::integer verified,
      count(*) filter(where c.assignment_id is null and now()<a.deadline_at)::integer pending,
      count(*) filter(where c.assignment_id is null and now()>=a.deadline_at)::integer overdue
    from public.activity_assignments x
    join public.activities a on a.id=x.activity_id
    join public.department_student_roster s on s.linked_student_id=x.student_id and s.active
    join public.profiles p on p.id=x.student_id and p.is_active and p.account_kind='student'
    join public.counselor_student_mappings m on m.roster_student_id=s.id
    join public.responsibility_assignments r on r.id=m.counselor_responsibility_id
    left join public.activity_completions c on c.assignment_id=x.id
    where r.user_id=auth.uid() and r.role='counselor'
      and r.starts_at<=now() and (r.ends_at is null or now()<r.ends_at)
      and m.starts_at<=now() and (m.ends_at is null or now()<m.ends_at)
    group by a.id,a.title,a.deadline_at
    order by a.deadline_at desc,a.id limit 50 offset p_offset
  ) q;
  return jsonb_build_object('activities',v_rows,'total',v_total,
    'offset',p_offset,'pageSize',50);
end $$;

revoke all on function public.counselor_activity_summaries(integer) from public,anon,authenticated;
grant execute on function public.counselor_activity_summaries(integer) to authenticated;
notify pgrst,'reload schema';
commit;
