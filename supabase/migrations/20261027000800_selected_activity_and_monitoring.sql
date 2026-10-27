begin;

-- Candidate names are exposed only inside a currently approved CREATE scope.
-- The same predicate is used again when a selected audience is published.
create function activity_private.targetable_students(
  p_department uuid, p_category text, p_counseling_only boolean
) returns table(student_id uuid, section_id uuid, student_name text, student_identifier text)
language sql stable security definer set search_path='' as $$
  select r.linked_student_id,r.section_scope_id,r.display_name,r.external_student_id
  from public.department_student_roster r
  join public.profiles p on p.id=r.linked_student_id and p.account_kind='student' and p.is_active
  join public.scopes s on s.id=r.section_scope_id and s.kind='section' and s.parent_id=p_department
  where r.department_scope_id=p_department and r.active
    and activity_private.can_manage(r.section_scope_id,p_category,'create')
    and exists(select 1 from public.student_scope_memberships m
      where m.student_id=r.linked_student_id and m.scope_id=r.section_scope_id
        and m.starts_at<=now() and (m.ends_at is null or now()<m.ends_at))
    and (not p_counseling_only or exists(
      select 1 from public.counselor_student_mappings cm
      join public.responsibility_assignments cr on cr.id=cm.counselor_responsibility_id
      where cm.roster_student_id=r.id and cr.user_id=auth.uid() and cr.role='counselor'
        and cr.starts_at<=now() and (cr.ends_at is null or now()<cr.ends_at)
        and cm.starts_at<=now() and (cm.ends_at is null or now()<cm.ends_at)))
$$;
revoke all on function activity_private.targetable_students(uuid,text,boolean) from public,anon,authenticated;

create function public.eligible_activity_students(
  p_department uuid,p_category text,p_counseling_only boolean default false,
  p_search text default '',p_offset integer default 0
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_total integer; v_rows jsonb;
begin
  if p_counseling_only is null or p_search is null or char_length(p_search)>80
    or p_offset is null or p_offset<0 or p_offset>10000
    or not exists(select 1 from public.scopes where id=p_department and kind='department') then
    raise exception 'Invalid candidate request.' using errcode='22023';
  end if;
  select count(*) into v_total from activity_private.targetable_students(
    p_department,p_category,p_counseling_only) t
    where position(lower(btrim(p_search)) in lower(t.student_name))>0
      or position(lower(btrim(p_search)) in lower(t.student_identifier))>0;
  select coalesce(jsonb_agg(jsonb_build_object('studentId',q.student_id,
    'sectionId',q.section_id,'name',q.student_name,'rollNumber',q.student_identifier)
    order by q.student_name,q.student_identifier),'[]'::jsonb) into v_rows from (
    select t.* from activity_private.targetable_students(
      p_department,p_category,p_counseling_only) t
    where position(lower(btrim(p_search)) in lower(t.student_name))>0
      or position(lower(btrim(p_search)) in lower(t.student_identifier))>0
    order by t.student_name,t.student_identifier limit 50 offset p_offset
  ) q;
  return jsonb_build_object('students',v_rows,'total',v_total,'offset',p_offset,'pageSize',50);
end $$;

-- Selected publication is a section-snapshot Activity, so existing completion,
-- history, RLS and creator-monitoring rules continue to apply.
create function public.create_selected_activity(
  p_category text,p_department uuid,p_students uuid[],p_counseling_only boolean,
  p_title text,p_description text,p_starts_at timestamptz,p_deadline_at timestamptz,
  p_ends_at timestamptz,p_requires_verification boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_activity uuid; v_scope uuid; v_sections integer;
begin
  if p_students is null or cardinality(p_students) not between 1 and 500
    or array_ndims(p_students)<>1 or array_position(p_students,null) is not null
    or cardinality(p_students)<>(select count(distinct x) from unnest(p_students) x)
    or p_counseling_only is null
    or not exists(select 1 from public.scopes where id=p_department and kind='department') then
    raise exception 'Invalid selected audience.' using errcode='22023';
  end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 160
    or p_description is null or char_length(p_description)>5000
    or p_requires_verification is null or p_starts_at is null or p_deadline_at is null
    or p_ends_at is null or not isfinite(p_starts_at) or not isfinite(p_deadline_at)
    or not isfinite(p_ends_at)
    or not (p_starts_at<p_deadline_at and p_deadline_at<=p_ends_at and now()<p_deadline_at) then
    raise exception 'Invalid Activity fields or dates.' using errcode='22023';
  end if;
  if (select count(*) from activity_private.targetable_students(
    p_department,p_category,p_counseling_only) t where t.student_id=any(p_students))
    <> cardinality(p_students) then
    raise exception 'Selected students are outside approved scope.' using errcode='42501';
  end if;
  select count(distinct t.section_id),min(t.section_id::text)::uuid
    into v_sections,v_scope from activity_private.targetable_students(
      p_department,p_category,p_counseling_only) t where t.student_id=any(p_students);
  if v_sections>1 then v_scope:=p_department; end if;
  insert into public.activities(category_key,scope_id,title,description,starts_at,
    deadline_at,ends_at,requires_verification,created_by)
    values(p_category,v_scope,btrim(p_title),p_description,p_starts_at,
      p_deadline_at,p_ends_at,p_requires_verification,v_actor) returning id into v_activity;
  insert into public.activity_target_sections(activity_id,section_scope_id)
    select distinct v_activity,t.section_id from activity_private.targetable_students(
      p_department,p_category,p_counseling_only) t where t.student_id=any(p_students);
  insert into public.activity_assignments(activity_id,student_id,assigned_by)
    select v_activity,x,v_actor from unnest(p_students) x;
  insert into public.activity_history(activity_id,actor_id,action)
    values(v_activity,v_actor,'created');
  insert into public.activity_history(activity_id,assignment_id,actor_id,action)
    select v_activity,id,v_actor,'assigned' from public.activity_assignments where activity_id=v_activity;
  return jsonb_build_object('id',v_activity,'assignedCount',cardinality(p_students));
end $$;

-- Counselor detail counts the complete current mapping set for one Activity.
create function activity_private.counselor_activity_rows(p_activity uuid)
returns table(assignment_id uuid,student_id uuid,student_name text,
  student_identifier text,completion_state text,submitted_at timestamptz,
  verified_at timestamptz,deadline_at timestamptz,requires_verification boolean)
language sql stable security definer set search_path='' as $$
  select x.id,x.student_id,s.display_name,s.external_student_id,c.state,
    c.submitted_at,c.verified_at,a.deadline_at,a.requires_verification
  from public.activity_assignments x
  join public.activities a on a.id=x.activity_id
  join public.department_student_roster s on s.linked_student_id=x.student_id and s.active
  join public.profiles p on p.id=x.student_id and p.is_active and p.account_kind='student'
  join public.counselor_student_mappings m on m.roster_student_id=s.id
  join public.responsibility_assignments r on r.id=m.counselor_responsibility_id
  left join public.activity_completions c on c.assignment_id=x.id
  where x.activity_id=p_activity and activity_private.active_kind()='staff'
    and r.user_id=auth.uid() and r.role='counselor'
    and r.starts_at<=now() and (r.ends_at is null or now()<r.ends_at)
    and m.starts_at<=now() and (m.ends_at is null or now()<m.ends_at)
$$;
revoke all on function activity_private.counselor_activity_rows(uuid) from public,anon,authenticated;

create function public.monitor_counselor_activity(p_activity uuid,p_offset integer default 0)
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
    'submittedAt',q.submitted_at,'verifiedAt',q.verified_at) order by q.assignment_id),
    '[]'::jsonb) into v_rows from (
    select * from activity_private.counselor_activity_rows(p_activity)
    order by assignment_id limit 50 offset p_offset
  ) q;
  return jsonb_build_object('activityId',p_activity,'title',v_title,
    'totalAssigned',v_total,'selfReportedCompleted',v_reported,
    'awaitingVerification',v_awaiting,'verified',v_verified,
    'pending',v_pending,'overdue',v_overdue,'assignments',v_rows,
    'offset',p_offset,'pageSize',50);
end $$;

-- A single authorized database query produces the entire pending copy set.
-- No clipboard action may silently copy just a visible page.
create function public.pending_students_text(p_activity uuid,p_counselor_view boolean)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_activity public.activities; v_allowed boolean; v_count integer; v_names text;
begin
  if p_counselor_view is null then raise exception 'Invalid view.' using errcode='22023'; end if;
  select * into v_activity from public.activities where id=p_activity;
  if not found or activity_private.active_kind()<>'staff' then
    raise exception 'Pending students are unavailable.' using errcode='42501';
  end if;
  if p_counselor_view then
    select exists(select 1 from activity_private.counselor_activity_rows(p_activity)) into v_allowed;
  else
    select v_activity.created_by=auth.uid() and (
      (exists(select 1 from public.activity_target_sections where activity_id=p_activity)
        and activity_private.can_monitor_created(p_activity))
      or (not exists(select 1 from public.activity_target_sections where activity_id=p_activity)
        and activity_private.can_manage(v_activity.scope_id,v_activity.category_key,'read')))
      into v_allowed;
  end if;
  if not coalesce(v_allowed,false) then
    raise exception 'Pending students are unavailable.' using errcode='42501';
  end if;
  if p_counselor_view then
    select count(*)::integer,string_agg(
      q.student_name||' ('||q.student_identifier||')',', ' order by q.student_name,q.student_identifier)
      into v_count,v_names from activity_private.counselor_activity_rows(p_activity) q
      where q.completion_state is null;
  else
    select count(*)::integer,string_agg(
      coalesce(r.display_name,p.display_name)||coalesce(' ('||r.external_student_id||')',''),
      ', ' order by coalesce(r.display_name,p.display_name),r.external_student_id)
      into v_count,v_names from public.activity_assignments x
      join public.profiles p on p.id=x.student_id
      left join public.department_student_roster r on r.linked_student_id=x.student_id
      left join public.activity_completions c on c.assignment_id=x.id
      where x.activity_id=p_activity and c.assignment_id is null;
  end if;
  if char_length(coalesce(v_names,''))>100000 then
    raise exception 'Pending list exceeds copy limit.' using errcode='22023';
  end if;
  return jsonb_build_object('count',v_count,'text',case when v_count=0
    then 'All assigned students have reported completion.'
    else 'Students yet to complete: '||v_names||'.' end);
end $$;

revoke all on function public.eligible_activity_students(uuid,text,boolean,text,integer),
  public.create_selected_activity(text,uuid,uuid[],boolean,text,text,timestamptz,timestamptz,timestamptz,boolean),
  public.monitor_counselor_activity(uuid,integer),public.pending_students_text(uuid,boolean)
  from public,anon,authenticated;
grant execute on function public.eligible_activity_students(uuid,text,boolean,text,integer),
  public.create_selected_activity(text,uuid,uuid[],boolean,text,text,timestamptz,timestamptz,timestamptz,boolean),
  public.monitor_counselor_activity(uuid,integer),public.pending_students_text(uuid,boolean)
  to authenticated;
notify pgrst,'reload schema';
commit;
