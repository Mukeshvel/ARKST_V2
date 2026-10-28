begin;

-- Include current members even if a later roster/account change made them
-- ineligible. Authorized staff must be able to remove stale memberships.
create function public.current_group_members(p_group uuid,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_department uuid; v_total integer; v_rows jsonb;
begin
  select department_scope_id into v_department from public.academic_groups where scope_id=p_group;
  if not found or not coalesce(activity_private.can_department_operation(v_department,'groups'),false) then
    raise exception 'Group members are not permitted.' using errcode='42501';
  end if;
  if p_offset is null or p_offset<0 or p_offset>10000 then
    raise exception 'Invalid group member offset.' using errcode='22023';
  end if;
  select count(*) into v_total from public.student_scope_memberships m
    where m.scope_id=p_group and m.starts_at<=now() and (m.ends_at is null or now()<m.ends_at);
  select coalesce(jsonb_agg(jsonb_build_object('studentId',q.student_id,
    'name',coalesce(r.display_name,p.display_name),'rollNumber',r.external_student_id,
    'eligible',coalesce(r.active and p.is_active and p.account_kind='student'
      and exists(select 1 from public.student_scope_memberships sm
        where sm.student_id=q.student_id and sm.scope_id=r.section_scope_id
          and sm.starts_at<=now() and (sm.ends_at is null or now()<sm.ends_at)),false),
    'memberSince',q.starts_at) order by q.starts_at,q.student_id),'[]'::jsonb) into v_rows from (
    select m.student_id,m.starts_at from public.student_scope_memberships m
      where m.scope_id=p_group and m.starts_at<=now() and (m.ends_at is null or now()<m.ends_at)
      order by m.starts_at,m.student_id limit 50 offset p_offset
  ) q join public.profiles p on p.id=q.student_id
    left join public.department_student_roster r on r.linked_student_id=q.student_id
      and r.department_scope_id=v_department;
  return jsonb_build_object('members',v_rows,'total',v_total,'offset',p_offset,'pageSize',50);
end $$;
revoke all on function public.current_group_members(uuid,integer) from public,anon,authenticated;
grant execute on function public.current_group_members(uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;
