begin;
-- Archiving blocks new members, but authorized managers may still remove old members.
create or replace function public.change_group_membership(p_group uuid,p_student uuid,p_add boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_group public.academic_groups; v_membership uuid;
begin
  select * into v_group from public.academic_groups where scope_id=p_group for update;
  if not found or not coalesce(activity_private.can_department_operation(v_group.department_scope_id,'groups'),false) then
    raise exception 'Group membership change is not permitted.' using errcode='42501';
  end if;
  if p_add is null or (p_add and not v_group.active) then raise exception 'Group is inactive or request is invalid.' using errcode='22023'; end if;
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

notify pgrst,'reload schema';
commit;
