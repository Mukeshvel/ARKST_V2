begin;

-- Announcements have an audience but never create Activity assignments.
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  department_scope_id uuid not null references public.scopes(id) on delete restrict,
  title text not null check(char_length(btrim(title)) between 1 and 160),
  message text not null check(char_length(btrim(message)) between 1 and 5000),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create table public.announcement_target_sections (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  section_scope_id uuid not null references public.scopes(id) on delete restrict,
  primary key(announcement_id,section_scope_id)
);
create table public.announcement_recipients (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  primary key(announcement_id,student_id)
);
create index announcement_recipient_student_idx on public.announcement_recipients(student_id,assigned_at desc);

-- One durable inbox record and one future-delivery outbox event per source/recipient.
-- No push worker exists in this milestone; processed_at remains NULL.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete restrict,
  source_kind text not null check(source_kind in ('activity','announcement')),
  source_id uuid not null,
  title text not null check(char_length(btrim(title)) between 1 and 160),
  message text not null check(char_length(btrim(message)) between 1 and 5000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique(recipient_id,source_kind,source_id)
);
create index notifications_recipient_created_idx on public.notifications(recipient_id,created_at desc,id);
create table public.notification_outbox (
  id bigint generated always as identity primary key,
  notification_id uuid not null unique references public.notifications(id) on delete restrict,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.announcements enable row level security;
alter table public.announcement_target_sections enable row level security;
alter table public.announcement_recipients enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_outbox enable row level security;
revoke all on public.announcements,public.announcement_target_sections,
  public.announcement_recipients,public.notifications,public.notification_outbox
  from public,anon,authenticated;
grant select on public.announcements,public.announcement_recipients,public.notifications to authenticated;
grant all on public.announcements,public.announcement_target_sections,
  public.announcement_recipients,public.notifications,public.notification_outbox to service_role;
revoke all on sequence public.notification_outbox_id_seq from public,anon,authenticated;
grant usage,select on sequence public.notification_outbox_id_seq to service_role;

create policy own_announcement_recipients on public.announcement_recipients
  for select to authenticated using (
    student_id=auth.uid() and activity_private.active_kind()='student');
create policy announcements_visible on public.announcements for select to authenticated
  using ((created_by=auth.uid() and activity_private.active_kind()='staff')
    or (activity_private.active_kind()='student' and exists(
      select 1 from public.announcement_recipients ar
      where ar.announcement_id=id and ar.student_id=auth.uid())));
create policy own_notifications on public.notifications for select to authenticated
  using (recipient_id=auth.uid() and activity_private.active_kind() is not null);

create function activity_private.enqueue_notification() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.notification_outbox(notification_id) values(new.id)
    on conflict(notification_id) do nothing;
  return new;
end $$;
create trigger notification_outbox_insert after insert on public.notifications
  for each row execute function activity_private.enqueue_notification();

create function activity_private.notify_activity_assignment() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.notifications(recipient_id,source_kind,source_id,title,message)
    select new.student_id,'activity',a.id,a.title,
      'A new '||c.label||' activity was assigned to you. Open it to view the deadline.'
    from public.activities a join public.activity_categories c on c.key=a.category_key
    where a.id=new.activity_id
    on conflict(recipient_id,source_kind,source_id) do nothing;
  return new;
end $$;
create trigger activity_assignment_notification after insert on public.activity_assignments
  for each row execute function activity_private.notify_activity_assignment();

create function activity_private.notify_announcement_recipient() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.notifications(recipient_id,source_kind,source_id,title,message)
    select new.student_id,'announcement',a.id,a.title,a.message
    from public.announcements a where a.id=new.announcement_id
    on conflict(recipient_id,source_kind,source_id) do nothing;
  return new;
end $$;
create trigger announcement_recipient_notification after insert on public.announcement_recipients
  for each row execute function activity_private.notify_announcement_recipient();

-- Explicit existing general-category CREATE approval is required for every
-- selected section. Counseling mode additionally requires current trusted mapping.
create function public.publish_announcement(
  p_department uuid,p_mode text,p_sections uuid[],p_students uuid[],
  p_title text,p_message text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_id uuid; v_count integer;
begin
  if p_title is null or char_length(btrim(p_title)) not between 1 and 160
    or p_message is null or char_length(btrim(p_message)) not between 1 and 5000
    or p_mode not in ('sections','selected','counseling')
    or not exists(select 1 from public.scopes where id=p_department and kind='department') then
    raise exception 'Invalid announcement.' using errcode='22023';
  end if;
  if p_mode='sections' then
    if p_students is not null or p_sections is null or cardinality(p_sections) not between 1 and 20
      or array_ndims(p_sections)<>1 or array_position(p_sections,null) is not null
      or cardinality(p_sections)<>(select count(distinct x) from unnest(p_sections) x)
      or exists(select 1 from unnest(p_sections) x where not exists(
        select 1 from public.scopes s where s.id=x and s.kind='section' and s.parent_id=p_department)) then
      raise exception 'Invalid announcement sections.' using errcode='22023';
    end if;
    if exists(select 1 from unnest(p_sections) x where not coalesce(
      activity_private.can_manage(x,'general','create'),false)) then
      raise exception 'Announcement scope is not permitted.' using errcode='42501';
    end if;
  else
    if p_sections is not null or p_students is null or cardinality(p_students) not between 1 and 500
      or array_ndims(p_students)<>1 or array_position(p_students,null) is not null
      or cardinality(p_students)<>(select count(distinct x) from unnest(p_students) x) then
      raise exception 'Invalid announcement recipients.' using errcode='22023';
    end if;
    if (select count(*) from activity_private.targetable_students(
      p_department,'general',p_mode='counseling') t where t.student_id=any(p_students))
      <>cardinality(p_students) then
      raise exception 'Announcement recipients are outside approved scope.' using errcode='42501';
    end if;
  end if;
  insert into public.announcements(department_scope_id,title,message,created_by)
    values(p_department,btrim(p_title),btrim(p_message),v_actor) returning id into v_id;
  if p_mode='sections' then
    insert into public.announcement_target_sections(announcement_id,section_scope_id)
      select v_id,x from unnest(p_sections) x;
    insert into public.announcement_recipients(announcement_id,student_id)
      select v_id,t.student_id from activity_private.targetable_students(
        p_department,'general',false) t where t.section_id=any(p_sections);
  else
    insert into public.announcement_target_sections(announcement_id,section_scope_id)
      select distinct v_id,t.section_id from activity_private.targetable_students(
        p_department,'general',p_mode='counseling') t where t.student_id=any(p_students);
    insert into public.announcement_recipients(announcement_id,student_id)
      select v_id,x from unnest(p_students) x;
  end if;
  select count(*) into v_count from public.announcement_recipients where announcement_id=v_id;
  if v_count=0 then
    raise exception 'No eligible provisioned recipients.' using errcode='22023';
  end if;
  return jsonb_build_object('id',v_id,'recipientCount',v_count);
end $$;

create function public.mark_notification_read(p_notification uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_notification public.notifications;
begin
  if activity_private.active_kind() is null then
    raise exception 'Notification is unavailable.' using errcode='42501';
  end if;
  update public.notifications set read_at=coalesce(read_at,now())
    where id=p_notification and recipient_id=auth.uid()
    returning * into v_notification;
  if not found then
    raise exception 'Notification is unavailable.' using errcode='42501';
  end if;
  return jsonb_build_object('id',v_notification.id,'readAt',v_notification.read_at);
end $$;

revoke all on function activity_private.enqueue_notification(),
  activity_private.notify_activity_assignment(),
  activity_private.notify_announcement_recipient() from public,anon,authenticated;
revoke all on function public.publish_announcement(uuid,text,uuid[],uuid[],text,text),
  public.mark_notification_read(uuid) from public,anon,authenticated;
grant execute on function public.publish_announcement(uuid,text,uuid[],uuid[],text,text),
  public.mark_notification_read(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
