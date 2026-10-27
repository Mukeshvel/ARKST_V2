begin;

-- Include deadline and policy on each authorized detail row so the client can
-- distinguish pending, overdue, self-reported and awaiting verification.
create or replace function public.monitor_counselor_activity(p_activity uuid,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_total integer; v_reported integer; v_awaiting integer; v_verified integer;
  v_pending integer; v_overdue integer; v_rows jsonb; v_title text;
begin
  if p_offset is null or p_offset<0 or p_offset>10000 then
    raise exception 'Invalid monitoring offset.' using errcode='22023';
  end if;
  select a.title into v_title from public.activities a where a.id=p_activity;
  select count(*)::integer,
    count(*) filter(where completion_state='reported' and not requires_verification)::integer,
    count(*) filter(where completion_state='reported' and requires_verification)::integer,
    count(*) filter(where completion_state='verified')::integer,
    count(*) filter(where completion_state is null and now()<deadline_at)::integer,
    count(*) filter(where completion_state is null and now()>=deadline_at)::integer
  into v_total,v_reported,v_awaiting,v_verified,v_pending,v_overdue
  from activity_private.counselor_activity_rows(p_activity);
  if v_total=0 then
    raise exception 'Counselor Activity is unavailable.' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('assignmentId',q.assignment_id,
    'studentId',q.student_id,'studentName',q.student_name,
    'studentIdentifier',q.student_identifier,'state',q.completion_state,
    'submittedAt',q.submitted_at,'verifiedAt',q.verified_at,
    'deadlineAt',q.deadline_at,'requiresVerification',q.requires_verification)
    order by q.assignment_id),'[]'::jsonb) into v_rows from (
    select * from activity_private.counselor_activity_rows(p_activity)
    order by assignment_id limit 50 offset p_offset
  ) q;
  return jsonb_build_object('activityId',p_activity,'title',v_title,
    'totalAssigned',v_total,'selfReportedCompleted',v_reported,
    'awaitingVerification',v_awaiting,'verified',v_verified,
    'pending',v_pending,'overdue',v_overdue,'assignments',v_rows,
    'offset',p_offset,'pageSize',50);
end $$;

notify pgrst,'reload schema';
commit;
