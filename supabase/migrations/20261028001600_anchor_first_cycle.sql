begin;
-- The anchor Monday is the first cycle. Never backfill earlier synthetic cycles.
create or replace function public.run_due_recurring_schedule_locked_body(p_schedule uuid,p_through date default null)
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
    if v_cycle<v_schedule.anchor_monday then continue; end if;
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


notify pgrst,'reload schema';
commit;
