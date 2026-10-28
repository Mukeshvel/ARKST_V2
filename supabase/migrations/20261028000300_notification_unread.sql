begin;

create function public.mark_notification_unread(p_notification uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_notification public.notifications;
begin
  if activity_private.active_kind() is null then
    raise exception 'Notification is unavailable.' using errcode='42501';
  end if;
  update public.notifications set read_at=null
    where id=p_notification and recipient_id=auth.uid()
    returning * into v_notification;
  if not found then
    raise exception 'Notification is unavailable.' using errcode='42501';
  end if;
  return jsonb_build_object('id',v_notification.id,'readAt',v_notification.read_at);
end $$;

revoke all on function public.mark_notification_unread(uuid) from public,anon,authenticated;
grant execute on function public.mark_notification_unread(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
