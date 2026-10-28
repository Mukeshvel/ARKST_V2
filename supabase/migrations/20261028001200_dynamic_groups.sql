begin;

-- Operational grants are trusted records tied to an effective-dated responsibility.
-- Neither role names nor editable designation text grant these operations.
create table public.department_operation_capabilities (
  responsibility_id uuid primary key references public.responsibility_assignments(id) on delete restrict,
  can_manage_groups boolean not null default false,
  can_manage_calendar boolean not null default false,
  can_supervise boolean not null default false,
  granted_at timestamptz not null default now(),
  check(can_manage_groups or can_manage_calendar or can_supervise)
);
alter table public.department_operation_capabilities enable row level security;
revoke all on public.department_operation_capabilities from public,anon,authenticated;
grant all on public.department_operation_capabilities to service_role;
create function activity_private.can_department_operation(p_department uuid,p_operation text)
returns boolean language sql stable security definer set search_path='' as $$
  select activity_private.active_kind()='staff' and exists(
    select 1 from public.department_operation_capabilities c
    join public.responsibility_assignments r on r.id=c.responsibility_id
    join public.scopes d on d.id=r.scope_id and d.kind='department'
    where r.user_id=auth.uid() and r.scope_id=p_department
      and r.starts_at<=now() and (r.ends_at is null or now()<r.ends_at)
      and case p_operation when 'groups' then c.can_manage_groups
        when 'calendar' then c.can_manage_calendar
        when 'supervise' then c.can_supervise else false end)
$$;

create unique index unique_department_group_name on public.scopes(parent_id,lower(name))
  where kind='group';
create table public.academic_groups (
  scope_id uuid primary key references public.scopes(id) on delete restrict,
  department_scope_id uuid not null references public.scopes(id) on delete restrict,
  group_type text not null check(char_length(btrim(group_type)) between 1 and 80),
  active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now()
);
create function activity_private.validate_academic_group() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.scopes g join public.scopes d on d.id=g.parent_id
    where g.id=new.scope_id and g.kind='group' and d.id=new.department_scope_id and d.kind='department') then
    raise exception 'Group scope must be a direct child of its department.' using errcode='23514';
  end if;
  return new;
end $$;
create trigger academic_group_validate before insert or update on public.academic_groups
  for each row execute function activity_private.validate_academic_group();
create function activity_private.guard_group_scope() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if (new.kind is distinct from old.kind or new.parent_id is distinct from old.parent_id)
    and exists(select 1 from public.academic_groups g where g.scope_id=old.id or g.department_scope_id=old.id) then
    raise exception 'Academic group scope relationship cannot be rewritten.' using errcode='23514';
  end if;
  return new;
end $$;
create trigger academic_group_scope_guard before update of kind,parent_id on public.scopes
  for each row execute function activity_private.guard_group_scope();

create unique index one_current_group_membership on public.student_scope_memberships(student_id,scope_id)
  where ends_at is null;
create function activity_private.validate_group_membership() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.scopes s where s.id=new.scope_id and s.kind='group') then
    if not exists(select 1 from public.academic_groups g
      join public.department_student_roster r on r.department_scope_id=g.department_scope_id
        and r.linked_student_id=new.student_id and r.active
      join public.profiles p on p.id=new.student_id and p.account_kind='student' and p.is_active
      join public.student_scope_memberships m on m.student_id=new.student_id
        and m.scope_id=r.section_scope_id and m.starts_at<=now()
        and (m.ends_at is null or now()<m.ends_at)
      where g.scope_id=new.scope_id and g.active) then
      raise exception 'Group member requires an active student in the group department and section.' using errcode='23514';
    end if;
  end if;
  return new;
end $$;
create trigger group_membership_validate before insert or update of student_id,scope_id
  on public.student_scope_memberships for each row execute function activity_private.validate_group_membership();

create table public.group_membership_history (
  id bigint generated always as identity primary key,
  group_id uuid not null references public.academic_groups(scope_id) on delete restrict,
  student_id uuid not null references public.profiles(id) on delete restrict,
  membership_id uuid not null references public.student_scope_memberships(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check(action in ('added','removed')),
  occurred_at timestamptz not null default now()
);
create index group_membership_history_group on public.group_membership_history(group_id,id);
create table public.activity_target_groups (
  activity_id uuid primary key references public.activities(id) on delete restrict,
  group_id uuid not null references public.academic_groups(scope_id) on delete restrict,
  member_count integer not null check(member_count between 1 and 500),
  excluded_count integer not null check(excluded_count>=0)
);
create table public.announcement_target_groups (
  announcement_id uuid primary key references public.announcements(id) on delete restrict,
  group_id uuid not null references public.academic_groups(scope_id) on delete restrict,
  member_count integer not null check(member_count between 1 and 500),
  excluded_count integer not null check(excluded_count>=0)
);
alter table public.academic_groups enable row level security;
alter table public.group_membership_history enable row level security;
alter table public.activity_target_groups enable row level security;
alter table public.announcement_target_groups enable row level security;
revoke all on public.academic_groups,public.group_membership_history,
  public.activity_target_groups,public.announcement_target_groups from public,anon,authenticated;
grant all on public.academic_groups,public.group_membership_history,
  public.activity_target_groups,public.announcement_target_groups to service_role;
revoke all on sequence public.group_membership_history_id_seq from public,anon,authenticated;
grant usage,select on sequence public.group_membership_history_id_seq to service_role;

create function public.department_operation_options() returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('departmentId',d.id,'departmentName',d.name,
    'manageGroups',activity_private.can_department_operation(d.id,'groups'),
    'manageCalendar',activity_private.can_department_operation(d.id,'calendar'),
    'supervise',activity_private.can_department_operation(d.id,'supervise')) order by d.name,d.id),'[]'::jsonb)
  from public.scopes d where d.kind='department' and activity_private.active_kind()='staff'
    and (activity_private.can_department_operation(d.id,'groups')
      or activity_private.can_department_operation(d.id,'calendar')
      or activity_private.can_department_operation(d.id,'supervise'))
$$;
create function public.create_academic_group(p_department uuid,p_name text,p_type text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if not coalesce(activity_private.can_department_operation(p_department,'groups'),false) then
    raise exception 'Group management is not permitted.' using errcode='42501';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 120
    or p_type is null or char_length(btrim(p_type)) not between 1 and 80 then
    raise exception 'Invalid group details.' using errcode='22023';
  end if;
  insert into public.scopes(name,kind,parent_id) values(btrim(p_name),'group',p_department)
    returning id into v_id;
  insert into public.academic_groups(scope_id,department_scope_id,group_type,created_by,updated_by)
    values(v_id,p_department,btrim(p_type),auth.uid(),auth.uid());
  return v_id;
end $$;
create function public.list_academic_groups(p_department uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_rows jsonb;
begin
  if not coalesce(activity_private.can_department_operation(p_department,'groups'),false) then
    raise exception 'Group list is not permitted.' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',g.scope_id,'name',s.name,
    'type',g.group_type,'active',g.active,'createdAt',g.created_at,
    'memberCount',(select count(*) from public.student_scope_memberships m
      where m.scope_id=g.scope_id and m.starts_at<=now() and (m.ends_at is null or now()<m.ends_at)))
    order by s.name,g.scope_id),'[]'::jsonb) into v_rows
  from public.academic_groups g join public.scopes s on s.id=g.scope_id
  where g.department_scope_id=p_department;
  return v_rows;
end $$;
create function public.group_eligible_students(p_group uuid,p_search text default '',p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_department uuid; v_total integer; v_rows jsonb;
begin
  select department_scope_id into v_department from public.academic_groups where scope_id=p_group;
  if not found or not coalesce(activity_private.can_department_operation(v_department,'groups'),false) then
    raise exception 'Group roster is not permitted.' using errcode='42501';
  end if;
  if p_search is null or char_length(p_search)>80 or p_offset is null or p_offset<0 or p_offset>10000 then
    raise exception 'Invalid group roster query.' using errcode='22023';
  end if;
  select count(*) into v_total from public.department_student_roster r
    join public.profiles p on p.id=r.linked_student_id and p.account_kind='student' and p.is_active
    where r.department_scope_id=v_department and r.active
      and exists(select 1 from public.student_scope_memberships sm
        where sm.student_id=r.linked_student_id and sm.scope_id=r.section_scope_id
          and sm.starts_at<=now() and (sm.ends_at is null or now()<sm.ends_at))
      and (position(lower(btrim(p_search)) in lower(r.display_name))>0
        or position(lower(btrim(p_search)) in lower(r.external_student_id))>0);
  select coalesce(jsonb_agg(jsonb_build_object('studentId',q.linked_student_id,
    'name',q.display_name,'rollNumber',q.external_student_id,'sectionId',q.section_scope_id,
    'member',exists(select 1 from public.student_scope_memberships m where m.student_id=q.linked_student_id
      and m.scope_id=p_group and m.starts_at<=now() and (m.ends_at is null or now()<m.ends_at)))
    order by q.display_name,q.external_student_id),'[]'::jsonb) into v_rows from (
    select r.* from public.department_student_roster r
    join public.profiles p on p.id=r.linked_student_id and p.account_kind='student' and p.is_active
    where r.department_scope_id=v_department and r.active
      and exists(select 1 from public.student_scope_memberships sm
        where sm.student_id=r.linked_student_id and sm.scope_id=r.section_scope_id
          and sm.starts_at<=now() and (sm.ends_at is null or now()<sm.ends_at))
      and (position(lower(btrim(p_search)) in lower(r.display_name))>0
        or position(lower(btrim(p_search)) in lower(r.external_student_id))>0)
    order by r.display_name,r.external_student_id limit 50 offset p_offset
  ) q;
  return jsonb_build_object('students',v_rows,'total',v_total,'offset',p_offset,'pageSize',50);
end $$;
create function public.change_group_membership(p_group uuid,p_student uuid,p_add boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_group public.academic_groups; v_membership uuid;
begin
  select * into v_group from public.academic_groups where scope_id=p_group for update;
  if not found or not coalesce(activity_private.can_department_operation(v_group.department_scope_id,'groups'),false) then
    raise exception 'Group membership change is not permitted.' using errcode='42501';
  end if;
  if p_add is null or not v_group.active then raise exception 'Group is inactive or request is invalid.' using errcode='22023'; end if;
  if p_add then
    if not exists(select 1 from public.department_student_roster r
      join public.profiles p on p.id=r.linked_student_id and p.account_kind='student' and p.is_active
      where r.department_scope_id=v_group.department_scope_id and r.linked_student_id=p_student and r.active
        and exists(select 1 from public.student_scope_memberships m where m.student_id=p_student
          and m.scope_id=r.section_scope_id and m.starts_at<=now() and (m.ends_at is null or now()<m.ends_at))) then
      raise exception 'Student is not eligible for this group.' using errcode='42501';
    end if;
    if exists(select 1 from public.student_scope_memberships m where m.student_id=p_student
      and m.scope_id=p_group and m.ends_at is null) then
      raise exception 'Student is already a member.' using errcode='23505';
    end if;
    insert into public.student_scope_memberships(student_id,scope_id)
      values(p_student,p_group) returning id into v_membership;
    insert into public.group_membership_history(group_id,student_id,membership_id,actor_id,action)
      values(p_group,p_student,v_membership,auth.uid(),'added');
  else
    update public.student_scope_memberships set ends_at=greatest(clock_timestamp(),starts_at+interval '1 microsecond')
      where student_id=p_student and scope_id=p_group and ends_at is null returning id into v_membership;
    if not found then raise exception 'Student is not a current member.' using errcode='23505'; end if;
    insert into public.group_membership_history(group_id,student_id,membership_id,actor_id,action)
      values(p_group,p_student,v_membership,auth.uid(),'removed');
  end if;
  return jsonb_build_object('groupId',p_group,'studentId',p_student,'member',p_add);
end $$;
create function public.group_membership_history(p_group uuid,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_department uuid; v_total integer; v_rows jsonb;
begin
  select department_scope_id into v_department from public.academic_groups where scope_id=p_group;
  if not found or not coalesce(activity_private.can_department_operation(v_department,'groups'),false) then
    raise exception 'Group history is not permitted.' using errcode='42501';
  end if;
  if p_offset is null or p_offset<0 or p_offset>10000 then raise exception 'Invalid offset.' using errcode='22023'; end if;
  select count(*) into v_total from public.group_membership_history where group_id=p_group;
  select coalesce(jsonb_agg(jsonb_build_object('studentId',q.student_id,
    'studentName',r.display_name,'rollNumber',r.external_student_id,
    'actorId',q.actor_id,'action',q.action,'occurredAt',q.occurred_at)
    order by q.id desc),'[]'::jsonb) into v_rows from (
    select * from public.group_membership_history where group_id=p_group
      order by id desc limit 50 offset p_offset
  ) q left join public.department_student_roster r on r.linked_student_id=q.student_id
    and r.department_scope_id=v_department;
  return jsonb_build_object('events',v_rows,'total',v_total,'offset',p_offset,'pageSize',50);
end $$;

create function public.publish_group_activity(p_group uuid,p_category text,p_title text,
  p_description text,p_starts_at timestamptz,p_deadline_at timestamptz,p_ends_at timestamptz,
  p_requires_verification boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_group public.academic_groups; v_students uuid[]; v_total integer;
  v_result jsonb;
begin
  select * into v_group from public.academic_groups where scope_id=p_group for update;
  if not found or not v_group.active or not coalesce(activity_private.can_department_operation(v_group.department_scope_id,'groups'),false) then
    raise exception 'Group publication is not permitted.' using errcode='42501';
  end if;
  select count(*) into v_total from public.student_scope_memberships m
    where m.scope_id=p_group and m.starts_at<=now() and (m.ends_at is null or now()<m.ends_at);
  select array_agg(t.student_id order by t.student_id) into v_students
    from activity_private.targetable_students(v_group.department_scope_id,p_category,false) t
    join public.student_scope_memberships m on m.student_id=t.student_id and m.scope_id=p_group
      and m.starts_at<=now() and (m.ends_at is null or now()<m.ends_at);
  if v_students is null or cardinality(v_students)>500 then
    raise exception 'Group has no eligible members or exceeds 500.' using errcode='22023';
  end if;
  if cardinality(v_students)<>v_total then
    raise exception 'Some group members are inactive or outside approved category/section scope.' using errcode='42501';
  end if;
  v_result:=public.create_selected_activity(p_category,v_group.department_scope_id,v_students,false,
    p_title,p_description,p_starts_at,p_deadline_at,p_ends_at,p_requires_verification);
  insert into public.activity_target_groups(activity_id,group_id,member_count,excluded_count)
    values((v_result->>'id')::uuid,p_group,cardinality(v_students),0);
  return v_result||jsonb_build_object('groupId',p_group);
end $$;
create function public.publish_group_announcement(p_group uuid,p_title text,p_message text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_group public.academic_groups; v_students uuid[]; v_total integer; v_result jsonb;
begin
  select * into v_group from public.academic_groups where scope_id=p_group for update;
  if not found or not v_group.active or not coalesce(activity_private.can_department_operation(v_group.department_scope_id,'groups'),false) then
    raise exception 'Group publication is not permitted.' using errcode='42501';
  end if;
  select count(*) into v_total from public.student_scope_memberships m
    where m.scope_id=p_group and m.starts_at<=now() and (m.ends_at is null or now()<m.ends_at);
  select array_agg(t.student_id order by t.student_id) into v_students
    from activity_private.targetable_students(v_group.department_scope_id,'general',false) t
    join public.student_scope_memberships m on m.student_id=t.student_id and m.scope_id=p_group
      and m.starts_at<=now() and (m.ends_at is null or now()<m.ends_at);
  if v_students is null or cardinality(v_students)>500 then
    raise exception 'Group has no eligible members or exceeds 500.' using errcode='22023';
  end if;
  if cardinality(v_students)<>v_total then
    raise exception 'Some group members are inactive or outside approved announcement scope.' using errcode='42501';
  end if;
  v_result:=public.publish_announcement(v_group.department_scope_id,'selected',null,v_students,p_title,p_message);
  insert into public.announcement_target_groups(announcement_id,group_id,member_count,excluded_count)
    values((v_result->>'id')::uuid,p_group,cardinality(v_students),0);
  return v_result||jsonb_build_object('groupId',p_group);
end $$;

revoke all on function activity_private.can_department_operation(uuid,text),
  activity_private.validate_academic_group(),activity_private.guard_group_scope(),
  activity_private.validate_group_membership() from public,anon,authenticated;
revoke all on function public.department_operation_options(),
  public.create_academic_group(uuid,text,text),public.list_academic_groups(uuid),
  public.group_eligible_students(uuid,text,integer),public.change_group_membership(uuid,uuid,boolean),
  public.group_membership_history(uuid,integer),
  public.publish_group_activity(uuid,text,text,text,timestamptz,timestamptz,timestamptz,boolean),
  public.publish_group_announcement(uuid,text,text) from public,anon,authenticated;
grant execute on function public.department_operation_options(),
  public.create_academic_group(uuid,text,text),public.list_academic_groups(uuid),
  public.group_eligible_students(uuid,text,integer),public.change_group_membership(uuid,uuid,boolean),
  public.group_membership_history(uuid,integer),
  public.publish_group_activity(uuid,text,text,text,timestamptz,timestamptz,timestamptz,boolean),
  public.publish_group_announcement(uuid,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
