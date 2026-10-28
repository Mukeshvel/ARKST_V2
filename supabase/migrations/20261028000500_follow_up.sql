begin;

-- Keep the existing inbox/outbox. New workflow notices carry a validated
-- same-origin destination; old Activity/announcement rows retain their links.
alter table public.notifications drop constraint notifications_source_kind_check;
alter table public.notifications add constraint notifications_source_kind_check
  check(source_kind in ('activity','announcement','follow_up','escalation','catch_up'));
alter table public.notifications add column target_path text;
alter table public.notifications add constraint notifications_target_path_check
  check(target_path is null or (target_path ~ '^/dashboard/[A-Za-z0-9/?=&_-]+$'
    and target_path !~ '//|\.\.'));
alter table public.notifications add constraint workflow_notification_target_check
  check(source_kind in ('activity','announcement') or target_path is not null);

create table public.activity_follow_ups (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.activity_assignments(id) on delete restrict,
  recipient_id uuid not null references public.profiles(id) on delete restrict,
  initiated_by uuid not null references public.profiles(id) on delete restrict,
  reason text not null check(char_length(btrim(reason)) between 1 and 500),
  status text not null default 'open' check(status in ('open','resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete restrict,
  resolution text check(resolution in ('student_reported','staff_closed')),
  resolution_note text check(resolution_note is null or char_length(btrim(resolution_note)) between 1 and 500),
  check((status='open' and resolved_at is null and resolved_by is null and resolution is null)
    or (status='resolved' and resolved_at is not null and resolved_by is not null and resolution is not null))
);
create unique index one_open_follow_up_per_assignment
  on public.activity_follow_ups(assignment_id) where status='open';
create index activity_follow_ups_assignment_time
  on public.activity_follow_ups(assignment_id,created_at desc);

create table public.activity_follow_up_history (
  id bigint generated always as identity primary key,
  follow_up_id uuid not null references public.activity_follow_ups(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check(action in ('sent','resolved_reported','resolved_staff')),
  occurred_at timestamptz not null default now(),
  note text check(note is null or char_length(btrim(note)) between 1 and 500)
);
create index follow_up_history_case_idx on public.activity_follow_up_history(follow_up_id,id);

-- A creator must retain authority over their own Activity and the student's
-- current section. Counselor access instead requires a current trusted mapping.
create function activity_private.can_follow_up_assignment(p_assignment uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select activity_private.active_kind()='staff' and exists(
    select 1 from public.activity_assignments x
    join public.activities a on a.id=x.activity_id
    join public.department_student_roster s on s.linked_student_id=x.student_id and s.active
    join public.profiles p on p.id=x.student_id and p.account_kind='student' and p.is_active
    where x.id=p_assignment and (
      activity_private.can_see_roster(s.id)
      or (a.created_by=auth.uid()
        and activity_private.can_manage(s.section_scope_id,a.category_key,'create')
        and ((exists(select 1 from public.activity_target_sections t where t.activity_id=a.id)
            and activity_private.can_monitor_created(a.id)
            and exists(select 1 from public.activity_target_sections t
              where t.activity_id=a.id and t.section_scope_id=s.section_scope_id))
          or (not exists(select 1 from public.activity_target_sections t where t.activity_id=a.id)
            and activity_private.can_manage(a.scope_id,a.category_key,'read'))))
    )
  )
$$;
create function activity_private.can_view_follow_up(p_follow_up uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.activity_follow_ups f where f.id=p_follow_up
    and ((f.recipient_id=auth.uid() and activity_private.active_kind()='student')
      or activity_private.can_follow_up_assignment(f.assignment_id)))
$$;

alter table public.activity_follow_ups enable row level security;
alter table public.activity_follow_up_history enable row level security;
revoke all on public.activity_follow_ups,public.activity_follow_up_history
  from public,anon,authenticated;
grant select on public.activity_follow_ups,public.activity_follow_up_history to authenticated;
grant all on public.activity_follow_ups,public.activity_follow_up_history to service_role;
revoke all on sequence public.activity_follow_up_history_id_seq from public,anon,authenticated;
grant usage,select on sequence public.activity_follow_up_history_id_seq to service_role;
create policy follow_up_scoped_read on public.activity_follow_ups
  for select to authenticated using (activity_private.can_view_follow_up(id));
create policy follow_up_history_scoped_read on public.activity_follow_up_history
  for select to authenticated using (activity_private.can_view_follow_up(follow_up_id));

-- One transaction, all-or-nothing, including the existing inbox/outbox insert.
-- Assignment locks serialize concurrent reminders and completion submission.
create function public.send_activity_follow_ups(p_assignments uuid[],p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_assignment uuid; v_student uuid; v_activity uuid; v_follow_up uuid;
  v_ids uuid[]:='{}'::uuid[];
begin
  if activity_private.active_kind()<>'staff' then
    raise exception 'Follow-up is not permitted.' using errcode='42501';
  end if;
  if p_assignments is null
    or cardinality(p_assignments) not between 1 and 100 or array_ndims(p_assignments)<>1
    or array_position(p_assignments,null) is not null
    or cardinality(p_assignments)<>(select count(distinct x) from unnest(p_assignments) x)
    or p_reason is null or char_length(btrim(p_reason)) not between 1 and 500 then
    raise exception 'Invalid follow-up request.' using errcode='22023';
  end if;
  for v_assignment in select x from unnest(p_assignments) x order by x loop
    select x.student_id,x.activity_id into v_student,v_activity
      from public.activity_assignments x where x.id=v_assignment for update;
    if not found or not coalesce(activity_private.can_follow_up_assignment(v_assignment),false) then
      raise exception 'Follow-up target is not permitted.' using errcode='42501';
    end if;
    if exists(select 1 from public.activity_completions c where c.assignment_id=v_assignment) then
      raise exception 'Student has already reported completion.' using errcode='23505';
    end if;
    if exists(select 1 from public.activity_follow_ups f where f.assignment_id=v_assignment
      and (f.status='open' or f.created_at>now()-interval '24 hours')) then
      raise exception 'Follow-up already sent recently.' using errcode='23505';
    end if;
    insert into public.activity_follow_ups(assignment_id,recipient_id,initiated_by,reason)
      values(v_assignment,v_student,auth.uid(),btrim(p_reason)) returning id into v_follow_up;
    insert into public.activity_follow_up_history(follow_up_id,actor_id,action,note)
      values(v_follow_up,auth.uid(),'sent',btrim(p_reason));
    insert into public.notifications(recipient_id,source_kind,source_id,title,message,target_path)
      values(v_student,'follow_up',v_follow_up,'Activity follow-up',
        'A staff member has asked you to review an assigned Activity.',
        '/dashboard/student?activity='||v_activity::text);
    v_ids:=array_append(v_ids,v_follow_up);
  end loop;
  return jsonb_build_object('count',cardinality(v_ids),'ids',to_jsonb(v_ids));
end $$;

create function public.resolve_activity_follow_up(p_follow_up uuid,p_note text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_follow_up public.activity_follow_ups;
begin
  if p_note is null or char_length(btrim(p_note)) not between 1 and 500 then
    raise exception 'A resolution note is required.' using errcode='22023';
  end if;
  select * into v_follow_up from public.activity_follow_ups where id=p_follow_up for update;
  if not found or not coalesce(activity_private.can_follow_up_assignment(v_follow_up.assignment_id),false) then
    raise exception 'Follow-up is unavailable.' using errcode='42501';
  end if;
  if v_follow_up.status<>'open' then
    raise exception 'Follow-up is already resolved.' using errcode='23505';
  end if;
  update public.activity_follow_ups set status='resolved',resolved_at=now(),
    resolved_by=auth.uid(),resolution='staff_closed',resolution_note=btrim(p_note)
    where id=p_follow_up;
  insert into public.activity_follow_up_history(follow_up_id,actor_id,action,note)
    values(p_follow_up,auth.uid(),'resolved_staff',btrim(p_note));
  return jsonb_build_object('id',p_follow_up,'status','resolved');
end $$;

create function activity_private.resolve_follow_up_on_report() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  for v_id in update public.activity_follow_ups
      set status='resolved',resolved_at=now(),resolved_by=new.submitted_by,
        resolution='student_reported'
      where assignment_id=new.assignment_id and status='open' returning id loop
    insert into public.activity_follow_up_history(follow_up_id,actor_id,action)
      values(v_id,new.submitted_by,'resolved_reported');
  end loop;
  return new;
end $$;
create trigger activity_completion_resolve_follow_up
  after insert on public.activity_completions for each row
  execute function activity_private.resolve_follow_up_on_report();

revoke all on function activity_private.can_follow_up_assignment(uuid),
  activity_private.can_view_follow_up(uuid),
  activity_private.resolve_follow_up_on_report() from public,anon,authenticated;
revoke all on function public.send_activity_follow_ups(uuid[],text),
  public.resolve_activity_follow_up(uuid,text) from public,anon,authenticated;
grant execute on function public.send_activity_follow_ups(uuid[],text),
  public.resolve_activity_follow_up(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
