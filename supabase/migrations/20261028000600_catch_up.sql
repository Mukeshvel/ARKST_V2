begin;

create table public.catch_up_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete restrict,
  roster_id uuid not null references public.department_student_roster(id) on delete restrict,
  section_scope_id uuid not null references public.scopes(id) on delete restrict,
  subject text not null check(char_length(btrim(subject)) between 1 and 160),
  missed_information text not null check(char_length(btrim(missed_information)) between 1 and 3000),
  status text not null default 'submitted' check(status in ('submitted','approved','rejected','published')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  rejection_reason text check(rejection_reason is null or char_length(btrim(rejection_reason)) between 1 and 500),
  announcement_id uuid unique references public.announcements(id) on delete restrict,
  check((status='submitted' and reviewed_by is null and reviewed_at is null and rejection_reason is null and announcement_id is null)
    or (status='approved' and reviewed_by is not null and reviewed_at is not null and rejection_reason is null and announcement_id is null)
    or (status='rejected' and reviewed_by is not null and reviewed_at is not null and rejection_reason is not null and announcement_id is null)
    or (status='published' and reviewed_by is not null and reviewed_at is not null and rejection_reason is null and announcement_id is not null))
);
create index catch_up_student_time on public.catch_up_requests(student_id,created_at desc);
create index catch_up_scope_status on public.catch_up_requests(section_scope_id,status,created_at desc);
create table public.catch_up_history (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.catch_up_requests(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check(action in ('submitted','approved','rejected','published')),
  occurred_at timestamptz not null default now(),
  note text
);
create index catch_up_history_request on public.catch_up_history(request_id,id);

create function activity_private.can_review_catch_up(p_request uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select activity_private.active_kind()='staff' and exists(
    select 1 from public.catch_up_requests c
    join public.department_student_roster r on r.id=c.roster_id and r.active
      and r.linked_student_id=c.student_id
    join public.profiles p on p.id=c.student_id and p.is_active and p.account_kind='student'
    where c.id=p_request and activity_private.can_manage(r.section_scope_id,'general','create'))
$$;
create function activity_private.can_view_catch_up(p_request uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.catch_up_requests c where c.id=p_request and
    ((c.student_id=auth.uid() and activity_private.active_kind()='student')
      or activity_private.can_review_catch_up(c.id)))
$$;
alter table public.catch_up_requests enable row level security;
alter table public.catch_up_history enable row level security;
revoke all on public.catch_up_requests,public.catch_up_history from public,anon,authenticated;
grant select on public.catch_up_requests,public.catch_up_history to authenticated;
grant all on public.catch_up_requests,public.catch_up_history to service_role;
revoke all on sequence public.catch_up_history_id_seq from public,anon,authenticated;
grant usage,select on sequence public.catch_up_history_id_seq to service_role;
create policy catch_up_scoped_read on public.catch_up_requests for select to authenticated
  using(activity_private.can_view_catch_up(id));
create policy catch_up_history_scoped_read on public.catch_up_history for select to authenticated
  using(activity_private.can_view_catch_up(request_id));

create function public.submit_catch_up_request(p_subject text,p_information text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_roster public.department_student_roster; v_id uuid;
begin
  if activity_private.active_kind()<>'student' then
    raise exception 'Only students may submit catch-up requests.' using errcode='42501';
  end if;
  if p_subject is null or char_length(btrim(p_subject)) not between 1 and 160
    or p_information is null or char_length(btrim(p_information)) not between 1 and 3000 then
    raise exception 'Invalid catch-up request.' using errcode='22023';
  end if;
  select * into v_roster from public.department_student_roster
    where linked_student_id=auth.uid() and active;
  if not found then raise exception 'An active linked roster entry is required.' using errcode='42501'; end if;
  if exists(select 1 from public.catch_up_requests c where c.student_id=auth.uid()
      and c.subject=btrim(p_subject) and c.created_at>now()-interval '24 hours'
      and c.status in ('submitted','approved')) then
    raise exception 'This request was already submitted recently.' using errcode='23505';
  end if;
  insert into public.catch_up_requests(student_id,roster_id,section_scope_id,subject,missed_information)
    values(auth.uid(),v_roster.id,v_roster.section_scope_id,btrim(p_subject),btrim(p_information))
    returning id into v_id;
  insert into public.catch_up_history(request_id,actor_id,action)
    values(v_id,auth.uid(),'submitted');
  return v_id;
end $$;

create function public.review_catch_up_request(p_request uuid,p_approve boolean,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row public.catch_up_requests;
begin
  select * into v_row from public.catch_up_requests where id=p_request for update;
  if not found or not coalesce(activity_private.can_review_catch_up(p_request),false) then
    raise exception 'Catch-up review is not permitted.' using errcode='42501';
  end if;
  if v_row.status<>'submitted' then
    raise exception 'Catch-up request has already been reviewed.' using errcode='23505';
  end if;
  if p_approve is null or (not p_approve and (p_reason is null or char_length(btrim(p_reason)) not between 1 and 500))
    or (p_approve and p_reason is not null) then
    raise exception 'Invalid review decision.' using errcode='22023';
  end if;
  update public.catch_up_requests set status=case when p_approve then 'approved' else 'rejected' end,
    reviewed_by=auth.uid(),reviewed_at=now(),rejection_reason=case when p_approve then null else btrim(p_reason) end
    where id=p_request;
  insert into public.catch_up_history(request_id,actor_id,action,note)
    values(p_request,auth.uid(),case when p_approve then 'approved' else 'rejected' end,p_reason);
  insert into public.notifications(recipient_id,source_kind,source_id,title,message,target_path)
    values(v_row.student_id,'catch_up',p_request,'Catch-up request reviewed',
      case when p_approve then 'Your request was approved for staff publication.'
        else 'Your request was rejected. Open ARKST to see the recorded reason.' end,
      '/dashboard/notifications');
  return jsonb_build_object('id',p_request,'status',case when p_approve then 'approved' else 'rejected' end);
end $$;

create function public.publish_catch_up_request(
  p_request uuid,p_department uuid,p_mode text,p_sections uuid[],p_students uuid[],
  p_title text,p_message text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row public.catch_up_requests; v_result jsonb; v_announcement uuid;
begin
  select * into v_row from public.catch_up_requests where id=p_request for update;
  if not found or not coalesce(activity_private.can_review_catch_up(p_request),false) then
    raise exception 'Catch-up publication is not permitted.' using errcode='42501';
  end if;
  if v_row.status<>'approved' then
    raise exception 'Only an approved request can be published once.' using errcode='23505';
  end if;
  if not exists(select 1 from public.scopes s where s.id=p_department and s.kind='department'
      and s.id=(select parent_id from public.scopes where id=v_row.section_scope_id)) then
    raise exception 'Publication must remain in the request department.' using errcode='42501';
  end if;
  v_result:=public.publish_announcement(p_department,p_mode,p_sections,p_students,p_title,p_message);
  v_announcement:=(v_result->>'id')::uuid;
  update public.catch_up_requests set status='published',announcement_id=v_announcement where id=p_request;
  insert into public.catch_up_history(request_id,actor_id,action,note)
    values(p_request,auth.uid(),'published','Official announcement '||v_announcement::text);
  return jsonb_build_object('id',p_request,'announcementId',v_announcement,
    'recipientCount',v_result->'recipientCount');
end $$;

create function public.list_catch_up_requests(p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_total integer; v_rows jsonb;
begin
  if activity_private.active_kind() is null or p_offset is null or p_offset<0 or p_offset>10000 then
    raise exception 'Invalid catch-up listing.' using errcode='22023';
  end if;
  select count(*) into v_total from public.catch_up_requests c
    where (c.student_id=auth.uid() and activity_private.active_kind()='student')
      or activity_private.can_review_catch_up(c.id);
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'studentId',q.student_id,'studentName',q.display_name,
    'studentIdentifier',q.external_student_id,'subject',q.subject,
    'missedInformation',q.missed_information,'status',q.status,
    'createdAt',q.created_at,'reviewedAt',q.reviewed_at,
    'rejectionReason',q.rejection_reason,'announcementId',q.announcement_id,
    'departmentId',q.department_scope_id,'sectionId',q.section_scope_id,
    'history',(select coalesce(jsonb_agg(jsonb_build_object(
      'action',h.action,'occurredAt',h.occurred_at,'note',h.note) order by h.id),'[]'::jsonb)
      from public.catch_up_history h where h.request_id=q.id)
  ) order by q.created_at desc,q.id),'[]'::jsonb) into v_rows from (
    select c.*,r.display_name,r.external_student_id,r.department_scope_id
    from public.catch_up_requests c join public.department_student_roster r on r.id=c.roster_id
    where (c.student_id=auth.uid() and activity_private.active_kind()='student')
      or activity_private.can_review_catch_up(c.id)
    order by c.created_at desc,c.id limit 50 offset p_offset
  ) q;
  return jsonb_build_object('requests',v_rows,'total',v_total,'offset',p_offset,'pageSize',50);
end $$;

revoke all on function activity_private.can_review_catch_up(uuid),
  activity_private.can_view_catch_up(uuid) from public,anon,authenticated;
revoke all on function public.submit_catch_up_request(text,text),
  public.review_catch_up_request(uuid,boolean,text),
  public.publish_catch_up_request(uuid,uuid,text,uuid[],uuid[],text,text),
  public.list_catch_up_requests(integer)
  from public,anon,authenticated;
grant execute on function public.submit_catch_up_request(text,text),
  public.review_catch_up_request(uuid,boolean,text),
  public.publish_catch_up_request(uuid,uuid,text,uuid[],uuid[],text,text),
  public.list_catch_up_requests(integer)
  to authenticated;
notify pgrst,'reload schema';
commit;
