begin;

create function public.missed_information_attention(p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_total integer; v_rows jsonb;
begin
  if activity_private.active_kind()<>'staff' or p_offset is null or p_offset<0 or p_offset>10000 then
    raise exception 'Missed-information view is unavailable.' using errcode='42501';
  end if;
  select count(*) into v_total from public.catch_up_requests c
    join public.department_student_roster r on r.id=c.roster_id and r.active
    join public.profiles p on p.id=c.student_id and p.account_kind='student' and p.is_active
    where c.status in ('submitted','approved') and activity_private.can_view_catch_up(c.id);
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'studentName',q.display_name,'studentIdentifier',q.external_student_id,
    'subject',q.subject,'missedInformation',q.missed_information,
    'status',q.status,'createdAt',q.created_at,
    'canReview',activity_private.can_review_catch_up(q.id)
  ) order by q.created_at desc,q.id),'[]'::jsonb) into v_rows from (
    select c.id,c.subject,c.missed_information,c.status,c.created_at,
      r.display_name,r.external_student_id
    from public.catch_up_requests c
    join public.department_student_roster r on r.id=c.roster_id and r.active
    join public.profiles p on p.id=c.student_id and p.account_kind='student' and p.is_active
    where c.status in ('submitted','approved') and activity_private.can_view_catch_up(c.id)
    order by c.created_at desc,c.id limit 50 offset p_offset
  ) q;
  return jsonb_build_object('requests',v_rows,'total',v_total,'offset',p_offset,'pageSize',50);
end $$;
revoke all on function public.missed_information_attention(integer) from public,anon,authenticated;
grant execute on function public.missed_information_attention(integer) to authenticated;
notify pgrst,'reload schema';
commit;
