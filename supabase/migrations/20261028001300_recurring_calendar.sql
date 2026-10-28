begin;

-- Schedules are configuration. A published occurrence remains an ordinary Activity
-- with immutable student assignment snapshots and the existing completion workflow.
create table public.recurring_schedules (
  id uuid primary key default gen_random_uuid(),
  department_scope_id uuid not null references public.scopes(id) on delete restrict,
  name text not null check(char_length(btrim(name)) between 1 and 120),
  description text not null default '' check(char_length(description)<=1000),
  timezone text not null default 'Asia/Kolkata',
  anchor_monday date not null,
  cycle_weeks integer not null check(cycle_weeks between 1 and 4),
  paused boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  check(extract(isodow from anchor_monday)=1)
);
create unique index unique_department_schedule_name on public.recurring_schedules(department_scope_id,lower(name));
create table public.recurring_schedule_sections (
  schedule_id uuid not null references public.recurring_schedules(id) on delete restrict,
  section_scope_id uuid not null references public.scopes(id) on delete restrict,
  primary key(schedule_id,section_scope_id)
);
create table public.recurring_schedule_slots (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.recurring_schedules(id) on delete restrict,
  position integer not null check(position between 1 and 20),
  week_offset integer not null check(week_offset between 0 and 3),
  start_day integer not null check(start_day between 0 and 6),
  end_day integer not null check(end_day between 0 and 6),
  start_time time without time zone not null,
  end_time time without time zone not null,
  title text not null check(char_length(btrim(title)) between 1 and 160),
  description text not null default '' check(char_length(description)<=5000),
  requires_verification boolean not null default false,
  active boolean not null default true,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  unique(schedule_id,position),
  check(end_day>=start_day),
  check(end_day>start_day or end_time>start_time)
);
create table public.academic_blackouts (
  id uuid primary key default gen_random_uuid(),
  department_scope_id uuid not null references public.scopes(id) on delete restrict,
  reason text not null check(char_length(btrim(reason)) between 1 and 500),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  check(isfinite(starts_at) and isfinite(ends_at) and starts_at<ends_at)
);
create index blackout_department_window on public.academic_blackouts(department_scope_id,starts_at,ends_at);
create table public.recurring_instances (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.recurring_schedules(id) on delete restrict,
  slot_id uuid not null references public.recurring_schedule_slots(id) on delete restrict,
  cycle_monday date not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null check(status in ('blocked','pending','skipped','published')),
  blackout_id uuid references public.academic_blackouts(id) on delete restrict,
  activity_id uuid unique references public.activities(id) on delete restrict,
  decided_by uuid references public.profiles(id) on delete restrict,
  decided_at timestamptz,
  generated_by uuid references public.profiles(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  unique(schedule_id,slot_id,cycle_monday),
  check((status='published' and activity_id is not null and generated_by is not null)
    or (status<>'published' and activity_id is null)),
  check((decided_by is null and decided_at is null) or (decided_by is not null and decided_at is not null))
);
create index recurring_instances_window on public.recurring_instances(schedule_id,starts_at);
create table public.activity_window_changes (
  id bigint generated always as identity primary key,
  activity_id uuid not null references public.activities(id) on delete restrict,
  old_deadline_at timestamptz not null,
  new_deadline_at timestamptz not null,
  old_ends_at timestamptz not null,
  new_ends_at timestamptz not null,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  occurred_at timestamptz not null default now()
);
create index activity_window_changes_activity on public.activity_window_changes(activity_id,id);

create function activity_private.validate_recurring_relationships() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_dept uuid; v_weeks integer;
begin
  if tg_table_name='recurring_schedules' then
    if not exists(select 1 from public.scopes where id=new.department_scope_id and kind='department')
      or not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone) then
      raise exception 'Schedule requires a department and IANA timezone.' using errcode='23514';
    end if;
  elsif tg_table_name='recurring_schedule_sections' then
    select department_scope_id into v_dept from public.recurring_schedules where id=new.schedule_id;
    if not exists(select 1 from public.scopes where id=new.section_scope_id and kind='section' and parent_id=v_dept) then
      raise exception 'Schedule section must belong to its department.' using errcode='23514';
    end if;
  elsif tg_table_name='recurring_schedule_slots' then
    select cycle_weeks into v_weeks from public.recurring_schedules where id=new.schedule_id;
    if new.week_offset>=v_weeks then
      raise exception 'Slot week exceeds schedule cycle.' using errcode='23514';
    end if;
  elsif tg_table_name='academic_blackouts' then
    if not exists(select 1 from public.scopes where id=new.department_scope_id and kind='department') then
      raise exception 'Blackout requires a department.' using errcode='23514';
    end if;
  end if;
  return new;
end $$;
create trigger recurring_schedule_validate before insert or update on public.recurring_schedules
  for each row execute function activity_private.validate_recurring_relationships();
create trigger recurring_section_validate before insert or update on public.recurring_schedule_sections
  for each row execute function activity_private.validate_recurring_relationships();
create trigger recurring_slot_validate before insert or update on public.recurring_schedule_slots
  for each row execute function activity_private.validate_recurring_relationships();
create trigger blackout_validate before insert or update on public.academic_blackouts
  for each row execute function activity_private.validate_recurring_relationships();

alter table public.recurring_schedules enable row level security;
alter table public.recurring_schedule_sections enable row level security;
alter table public.recurring_schedule_slots enable row level security;
alter table public.academic_blackouts enable row level security;
alter table public.recurring_instances enable row level security;
alter table public.activity_window_changes enable row level security;
revoke all on public.recurring_schedules,public.recurring_schedule_sections,public.recurring_schedule_slots,
  public.academic_blackouts,public.recurring_instances,public.activity_window_changes from public,anon,authenticated;
grant all on public.recurring_schedules,public.recurring_schedule_sections,public.recurring_schedule_slots,
  public.academic_blackouts,public.recurring_instances,public.activity_window_changes to service_role;
revoke all on sequence public.activity_window_changes_id_seq from public,anon,authenticated;
grant usage,select on sequence public.activity_window_changes_id_seq to service_role;

create function public.create_recurring_schedule(p_department uuid,p_name text,p_description text,
  p_timezone text,p_anchor_monday date,p_cycle_weeks integer,p_sections uuid[])
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if not coalesce(activity_private.can_department_operation(p_department,'calendar'),false) then
    raise exception 'Calendar management is not permitted.' using errcode='42501';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 120 or p_description is null
    or char_length(p_description)>1000 or p_timezone is null or p_anchor_monday is null
    or p_cycle_weeks not between 1 and 4 or p_sections is null or cardinality(p_sections) not between 1 and 20
    or array_ndims(p_sections)<>1 or array_position(p_sections,null) is not null
    or cardinality(p_sections)<>(select count(distinct x) from unnest(p_sections) x)
    or exists(select 1 from unnest(p_sections) x where not exists(select 1 from public.scopes s
      where s.id=x and s.kind='section' and s.parent_id=p_department)) then
    raise exception 'Invalid recurring schedule.' using errcode='22023';
  end if;
  insert into public.recurring_schedules(department_scope_id,name,description,timezone,anchor_monday,
    cycle_weeks,created_by,updated_by)
    values(p_department,btrim(p_name),p_description,p_timezone,p_anchor_monday,p_cycle_weeks,auth.uid(),auth.uid())
    returning id into v_id;
  insert into public.recurring_schedule_sections(schedule_id,section_scope_id)
    select v_id,x from unnest(p_sections) x;
  return v_id;
end $$;

create function public.configure_recurring_schedule(p_schedule uuid,p_name text,p_description text,
  p_sections uuid[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_schedule public.recurring_schedules;
begin
  select * into v_schedule from public.recurring_schedules where id=p_schedule for update;
  if not found or not coalesce(activity_private.can_department_operation(v_schedule.department_scope_id,'calendar'),false) then
    raise exception 'Calendar management is not permitted.' using errcode='42501';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 120 or p_description is null
    or char_length(p_description)>1000 or p_sections is null or cardinality(p_sections) not between 1 and 20
    or array_ndims(p_sections)<>1 or array_position(p_sections,null) is not null
    or cardinality(p_sections)<>(select count(distinct x) from unnest(p_sections) x)
    or exists(select 1 from unnest(p_sections) x where not exists(select 1 from public.scopes s
      where s.id=x and s.kind='section' and s.parent_id=v_schedule.department_scope_id)) then
    raise exception 'Invalid schedule configuration.' using errcode='22023';
  end if;
  update public.recurring_schedules set name=btrim(p_name),description=p_description,
    updated_by=auth.uid(),updated_at=now() where id=p_schedule;
  delete from public.recurring_schedule_sections where schedule_id=p_schedule;
  insert into public.recurring_schedule_sections(schedule_id,section_scope_id)
    select p_schedule,x from unnest(p_sections) x;
  return jsonb_build_object('id',p_schedule,'updated',true);
end $$;

create function public.set_recurring_schedule_paused(p_schedule uuid,p_paused boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_dept uuid;
begin
  select department_scope_id into v_dept from public.recurring_schedules where id=p_schedule for update;
  if not found or not coalesce(activity_private.can_department_operation(v_dept,'calendar'),false) then
    raise exception 'Calendar management is not permitted.' using errcode='42501';
  end if;
  if p_paused is null then raise exception 'Pause state is required.' using errcode='22023'; end if;
  update public.recurring_schedules set paused=p_paused,updated_by=auth.uid(),updated_at=now() where id=p_schedule;
  return jsonb_build_object('id',p_schedule,'paused',p_paused);
end $$;

create function public.configure_recurring_slot(p_schedule uuid,p_position integer,p_week_offset integer,
  p_start_day integer,p_end_day integer,p_start_time time,p_end_time time,p_title text,
  p_description text,p_requires_verification boolean,p_active boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_schedule public.recurring_schedules; v_id uuid; v_start timestamp; v_end timestamp;
begin
  select * into v_schedule from public.recurring_schedules where id=p_schedule for update;
  if not found or not coalesce(activity_private.can_department_operation(v_schedule.department_scope_id,'calendar'),false) then
    raise exception 'Calendar management is not permitted.' using errcode='42501';
  end if;
  if p_position not between 1 and 20 or p_week_offset not between 0 and v_schedule.cycle_weeks-1
    or p_start_day not between 0 and 6 or p_end_day not between p_start_day and 6
    or p_start_time is null or p_end_time is null or p_title is null
    or char_length(btrim(p_title)) not between 1 and 160 or p_description is null
    or char_length(p_description)>5000 or p_requires_verification is null or p_active is null then
    raise exception 'Invalid recurring slot.' using errcode='22023';
  end if;
  v_start:=v_schedule.anchor_monday+(p_week_offset*7+p_start_day)+p_start_time;
  v_end:=v_schedule.anchor_monday+(p_week_offset*7+p_end_day)+p_end_time;
  if v_start>=v_end then raise exception 'Slot end must follow start.' using errcode='22023'; end if;
  if p_active and exists(select 1 from public.recurring_schedule_slots s
    where s.schedule_id=p_schedule and s.position<>p_position and s.active
      and tsrange(v_schedule.anchor_monday+(s.week_offset*7+s.start_day)+s.start_time,
        v_schedule.anchor_monday+(s.week_offset*7+s.end_day)+s.end_time,'[)')
        && tsrange(v_start,v_end,'[)')) then
    raise exception 'Recurring test windows overlap.' using errcode='23514';
  end if;
  insert into public.recurring_schedule_slots(schedule_id,position,week_offset,start_day,end_day,
    start_time,end_time,title,description,requires_verification,active,updated_by)
    values(p_schedule,p_position,p_week_offset,p_start_day,p_end_day,p_start_time,p_end_time,
      btrim(p_title),p_description,p_requires_verification,p_active,auth.uid())
    on conflict(schedule_id,position) do update set week_offset=excluded.week_offset,
      start_day=excluded.start_day,end_day=excluded.end_day,start_time=excluded.start_time,
      end_time=excluded.end_time,title=excluded.title,description=excluded.description,
      requires_verification=excluded.requires_verification,active=excluded.active,
      updated_by=auth.uid(),updated_at=now() returning id into v_id;
  return v_id;
end $$;

create function public.create_academic_blackout(p_department uuid,p_reason text,
  p_starts_at timestamptz,p_ends_at timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if not coalesce(activity_private.can_department_operation(p_department,'calendar'),false) then
    raise exception 'Blackout management is not permitted.' using errcode='42501';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 1 and 500
    or p_starts_at is null or p_ends_at is null or not isfinite(p_starts_at) or not isfinite(p_ends_at)
    or p_starts_at>=p_ends_at then
    raise exception 'Invalid blackout.' using errcode='22023';
  end if;
  insert into public.academic_blackouts(department_scope_id,reason,starts_at,ends_at,created_by,updated_by)
    values(p_department,btrim(p_reason),p_starts_at,p_ends_at,auth.uid(),auth.uid()) returning id into v_id;
  return v_id;
end $$;

create function public.set_academic_blackout_active(p_blackout uuid,p_active boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_dept uuid;
begin
  select department_scope_id into v_dept from public.academic_blackouts where id=p_blackout for update;
  if not found or not coalesce(activity_private.can_department_operation(v_dept,'calendar'),false) then
    raise exception 'Blackout management is not permitted.' using errcode='42501';
  end if;
  if p_active is null then raise exception 'Active state is required.' using errcode='22023'; end if;
  update public.academic_blackouts set active=p_active,updated_by=auth.uid(),updated_at=now() where id=p_blackout;
  return jsonb_build_object('id',p_blackout,'active',p_active);
end $$;

create function public.run_due_recurring_schedule(p_schedule uuid,p_through date default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_schedule public.recurring_schedules; v_slot public.recurring_schedule_slots;
  v_today date; v_through date; v_cycle date; v_start_local timestamp; v_end_local timestamp;
  v_start timestamptz; v_end timestamptz; v_blackout uuid; v_instance public.recurring_instances;
  v_sections uuid[]; v_result jsonb; v_published integer:=0; v_blocked integer:=0;
  v_existing integer:=0; v_n integer; v_base integer;
begin
  select * into v_schedule from public.recurring_schedules where id=p_schedule for update;
  if not found or not coalesce(activity_private.can_department_operation(v_schedule.department_scope_id,'calendar'),false) then
    raise exception 'Calendar runner is not permitted.' using errcode='42501';
  end if;
  v_today:=(now() at time zone v_schedule.timezone)::date;
  v_through:=coalesce(p_through,v_today+14);
  if v_through<v_today or v_through>v_today+28 then
    raise exception 'Runner horizon must be today through the next 28 days.' using errcode='22023';
  end if;
  if v_schedule.paused then return jsonb_build_object('published',0,'blocked',0,'existing',0,'paused',true); end if;
  select array_agg(section_scope_id order by section_scope_id) into v_sections
    from public.recurring_schedule_sections where schedule_id=p_schedule;
  if v_sections is null then raise exception 'Schedule has no sections.' using errcode='23514'; end if;
  v_base:=floor((v_today-v_schedule.anchor_monday)::numeric/(v_schedule.cycle_weeks*7))::integer;
  for v_n in v_base-1..v_base+4 loop
    v_cycle:=v_schedule.anchor_monday+v_n*v_schedule.cycle_weeks*7;
    for v_slot in select * from public.recurring_schedule_slots
      where schedule_id=p_schedule and active order by position loop
      v_start_local:=v_cycle+(v_slot.week_offset*7+v_slot.start_day)+v_slot.start_time;
      v_end_local:=v_cycle+(v_slot.week_offset*7+v_slot.end_day)+v_slot.end_time;
      if v_start_local::date<v_today-6 or v_start_local::date>v_through then continue; end if;
      v_start:=v_start_local at time zone v_schedule.timezone;
      v_end:=v_end_local at time zone v_schedule.timezone;
      if (v_start at time zone v_schedule.timezone)<>v_start_local
        or (v_end at time zone v_schedule.timezone)<>v_end_local then
        raise exception 'Local calendar time does not exist in schedule timezone.' using errcode='22023';
      end if;
      select * into v_instance from public.recurring_instances
        where schedule_id=p_schedule and slot_id=v_slot.id and cycle_monday=v_cycle;
      if found and v_instance.status<>'pending' then v_existing:=v_existing+1; continue; end if;
      if v_end<=now() then continue; end if;
      select id into v_blackout from public.academic_blackouts
        where department_scope_id=v_schedule.department_scope_id and active
          and starts_at<v_end and ends_at>v_start order by starts_at,id limit 1;
      if found then
        if v_instance.id is null then
          insert into public.recurring_instances(schedule_id,slot_id,cycle_monday,starts_at,ends_at,
            status,blackout_id) values(p_schedule,v_slot.id,v_cycle,v_start,v_end,'blocked',v_blackout);
          v_blocked:=v_blocked+1;
        else
          update public.recurring_instances set status='blocked',blackout_id=v_blackout
            where id=v_instance.id;
          v_blocked:=v_blocked+1;
        end if;
        continue;
      end if;
      -- Reuse the verified section publication function: it checks the caller's
      -- current category CREATE grants, snapshots assignments and creates notices.
      v_result:=public.create_section_activity('weekly_test',v_schedule.department_scope_id,
        v_sections,v_slot.title,v_slot.description,v_start,v_end,v_end,v_slot.requires_verification);
      if v_instance.id is null then
        insert into public.recurring_instances(schedule_id,slot_id,cycle_monday,starts_at,ends_at,
          status,activity_id,generated_by)
          values(p_schedule,v_slot.id,v_cycle,v_start,v_end,'published',(v_result->>'id')::uuid,auth.uid());
      else
        update public.recurring_instances set status='published',activity_id=(v_result->>'id')::uuid,
          generated_by=auth.uid(),starts_at=v_start,ends_at=v_end where id=v_instance.id;
      end if;
      v_published:=v_published+1;
      v_instance:=null;
    end loop;
  end loop;
  return jsonb_build_object('published',v_published,'blocked',v_blocked,'existing',v_existing,'paused',false);
end $$;

create function public.decide_blocked_recurring_instance(p_instance uuid,p_decision text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_instance public.recurring_instances; v_dept uuid;
begin
  select * into v_instance from public.recurring_instances where id=p_instance for update;
  select department_scope_id into v_dept from public.recurring_schedules where id=v_instance.schedule_id;
  if not found or not coalesce(activity_private.can_department_operation(v_dept,'calendar'),false) then
    raise exception 'Conflict decision is not permitted.' using errcode='42501';
  end if;
  if v_instance.status<>'blocked' or p_decision not in ('skip','requeue') then
    raise exception 'Only a blocked instance may be decided.' using errcode='22023';
  end if;
  if p_decision='requeue' and exists(select 1 from public.academic_blackouts b
    where b.department_scope_id=v_dept and b.active
      and b.starts_at<v_instance.ends_at and b.ends_at>v_instance.starts_at) then
    raise exception 'Blackout still covers this instance.' using errcode='23514';
  end if;
  update public.recurring_instances set status=case p_decision when 'skip' then 'skipped' else 'pending' end,
    decided_by=auth.uid(),decided_at=now() where id=p_instance;
  return jsonb_build_object('id',p_instance,'decision',p_decision);
end $$;

create function public.calendar_overview(p_department uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_schedules jsonb; v_blackouts jsonb; v_conflicts jsonb;
begin
  if not coalesce(activity_private.can_department_operation(p_department,'calendar'),false) then
    raise exception 'Calendar view is not permitted.' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'description',s.description,
    'timezone',s.timezone,'anchorMonday',s.anchor_monday,'cycleWeeks',s.cycle_weeks,'paused',s.paused,
    'sections',(select coalesce(jsonb_agg(x.section_scope_id order by x.section_scope_id),'[]'::jsonb)
      from public.recurring_schedule_sections x where x.schedule_id=s.id),
    'slots',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'position',t.position,
      'weekOffset',t.week_offset,'startDay',t.start_day,'endDay',t.end_day,
      'startTime',t.start_time,'endTime',t.end_time,'title',t.title,'description',t.description,
      'requiresVerification',t.requires_verification,'active',t.active) order by t.position),'[]'::jsonb)
      from public.recurring_schedule_slots t where t.schedule_id=s.id)) order by s.name,s.id),'[]'::jsonb)
    into v_schedules from public.recurring_schedules s where s.department_scope_id=p_department;
  select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'reason',b.reason,
    'startsAt',b.starts_at,'endsAt',b.ends_at,'active',b.active)
    order by b.starts_at desc,b.id),'[]'::jsonb) into v_blackouts
    from public.academic_blackouts b where b.department_scope_id=p_department;
  select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'scheduleId',q.schedule_id,
    'title',q.title,'startsAt',q.starts_at,'endsAt',q.ends_at,'status',q.status,
    'blackoutId',q.blackout_id,'activityId',q.activity_id,'publishedOverlap',q.published_overlap)
    order by q.starts_at,q.id),'[]'::jsonb) into v_conflicts from (
    select i.*,t.title,exists(select 1 from public.academic_blackouts b
      where b.department_scope_id=p_department and b.active
        and b.starts_at<i.ends_at and b.ends_at>i.starts_at) as published_overlap
    from public.recurring_instances i join public.recurring_schedules s on s.id=i.schedule_id
      join public.recurring_schedule_slots t on t.id=i.slot_id
    where s.department_scope_id=p_department and (i.status='blocked' or
      (i.status='published' and exists(select 1 from public.academic_blackouts b
        where b.department_scope_id=p_department and b.active
          and b.starts_at<i.ends_at and b.ends_at>i.starts_at)))
    order by i.starts_at,i.id limit 100
  ) q;
  return jsonb_build_object('schedules',v_schedules,'blackouts',v_blackouts,
    'conflicts',v_conflicts,'conflictsLimited',jsonb_array_length(v_conflicts)=100);
end $$;

create function public.change_activity_window(p_activity uuid,p_deadline_at timestamptz,p_ends_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_activity public.activities;
begin
  select * into v_activity from public.activities where id=p_activity for update;
  if not found or activity_private.active_kind()<>'staff' or v_activity.created_by<>auth.uid()
    or exists(select 1 from public.activity_target_sections t where t.activity_id=p_activity
      and not coalesce(activity_private.can_manage(t.section_scope_id,v_activity.category_key,'create'),false))
    or (not exists(select 1 from public.activity_target_sections t where t.activity_id=p_activity)
      and not coalesce(activity_private.can_manage(v_activity.scope_id,v_activity.category_key,'create'),false)) then
    raise exception 'Activity window change is not permitted.' using errcode='42501';
  end if;
  if p_deadline_at is null or p_ends_at is null or not isfinite(p_deadline_at) or not isfinite(p_ends_at)
    or not (v_activity.starts_at<p_deadline_at and p_deadline_at<=p_ends_at and now()<p_deadline_at)
    or (p_deadline_at=v_activity.deadline_at and p_ends_at=v_activity.ends_at) then
    raise exception 'Invalid or unchanged Activity window.' using errcode='22023';
  end if;
  update public.activities set deadline_at=p_deadline_at,ends_at=p_ends_at where id=p_activity;
  insert into public.activity_window_changes(activity_id,old_deadline_at,new_deadline_at,
    old_ends_at,new_ends_at,actor_id) values(p_activity,v_activity.deadline_at,p_deadline_at,
    v_activity.ends_at,p_ends_at,auth.uid());
  return jsonb_build_object('id',p_activity,'deadlineAt',p_deadline_at,'endsAt',p_ends_at);
end $$;

revoke all on function activity_private.validate_recurring_relationships() from public,anon,authenticated;
revoke all on function public.create_recurring_schedule(uuid,text,text,text,date,integer,uuid[]),
  public.configure_recurring_schedule(uuid,text,text,uuid[]),public.set_recurring_schedule_paused(uuid,boolean),
  public.configure_recurring_slot(uuid,integer,integer,integer,integer,time,time,text,text,boolean,boolean),
  public.create_academic_blackout(uuid,text,timestamptz,timestamptz),
  public.set_academic_blackout_active(uuid,boolean),public.run_due_recurring_schedule(uuid,date),
  public.decide_blocked_recurring_instance(uuid,text),public.calendar_overview(uuid),
  public.change_activity_window(uuid,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.create_recurring_schedule(uuid,text,text,text,date,integer,uuid[]),
  public.configure_recurring_schedule(uuid,text,text,uuid[]),public.set_recurring_schedule_paused(uuid,boolean),
  public.configure_recurring_slot(uuid,integer,integer,integer,integer,time,time,text,text,boolean,boolean),
  public.create_academic_blackout(uuid,text,timestamptz,timestamptz),
  public.set_academic_blackout_active(uuid,boolean),public.run_due_recurring_schedule(uuid,date),
  public.decide_blocked_recurring_instance(uuid,text),public.calendar_overview(uuid),
  public.change_activity_window(uuid,timestamptz,timestamptz) to authenticated;
notify pgrst,'reload schema';
commit;
