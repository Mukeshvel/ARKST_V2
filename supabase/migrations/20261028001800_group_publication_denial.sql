begin;
-- Empty groups are invalid; nonempty groups outside CREATE scope are forbidden.
create or replace function public.publish_group_activity(p_group uuid,p_category text,p_title text,
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
  if v_total=0 or v_total>500 then
    raise exception 'Group has no members or exceeds 500.' using errcode='22023';
  end if;
  if v_students is null then
    raise exception 'Group members are outside approved publication scope.' using errcode='42501';
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
create or replace function public.publish_group_announcement(p_group uuid,p_title text,p_message text)
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
  if v_total=0 or v_total>500 then
    raise exception 'Group has no members or exceeds 500.' using errcode='22023';
  end if;
  if v_students is null then
    raise exception 'Group members are outside approved publication scope.' using errcode='42501';
  end if;
  if cardinality(v_students)<>v_total then
    raise exception 'Some group members are inactive or outside approved announcement scope.' using errcode='42501';
  end if;
  v_result:=public.publish_announcement(v_group.department_scope_id,'selected',null,v_students,p_title,p_message);
  insert into public.announcement_target_groups(announcement_id,group_id,member_count,excluded_count)
    values((v_result->>'id')::uuid,p_group,cardinality(v_students),0);
  return v_result||jsonb_build_object('groupId',p_group);
end $$;


notify pgrst,'reload schema';
commit;
