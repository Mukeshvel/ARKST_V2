begin;

-- Serialize registration per account so the ordinary API cannot accumulate an
-- unbounded number of active endpoints, including concurrent requests.
create or replace function public.register_push_subscription(
  p_endpoint text,p_p256dh text,p_auth text,p_expires_at timestamptz
) returns boolean language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if activity_private.active_kind() is null
    or p_endpoint is null or char_length(p_endpoint) not between 20 and 2048
    or p_endpoint not like 'https://%'
    or p_p256dh is null or p_p256dh !~ '^[A-Za-z0-9_-]{40,180}$'
    or p_auth is null or p_auth !~ '^[A-Za-z0-9_-]{16,100}$'
    or (p_expires_at is not null and (not isfinite(p_expires_at) or p_expires_at<=now())) then
    raise exception 'Invalid push subscription.' using errcode='22023';
  end if;
  perform 1 from public.profiles where id=auth.uid() for update;
  if not exists(select 1 from public.push_subscriptions
      where endpoint=p_endpoint and user_id=auth.uid())
    and (select count(*) from public.push_subscriptions
      where user_id=auth.uid() and active and (expires_at is null or expires_at>now()))>=10 then
    raise exception 'Device subscription limit reached.' using errcode='22023';
  end if;
  insert into public.push_subscriptions(user_id,endpoint,p256dh,auth_secret,expires_at)
    values(auth.uid(),p_endpoint,p_p256dh,p_auth,p_expires_at)
    on conflict(endpoint) do update set p256dh=excluded.p256dh,
      auth_secret=excluded.auth_secret,expires_at=excluded.expires_at,
      active=true,disabled_at=null,updated_at=now()
    where push_subscriptions.user_id=auth.uid()
    returning id into v_id;
  if v_id is null then
    raise exception 'Subscription belongs to another account.' using errcode='42501';
  end if;
  return true;
end $$;

notify pgrst,'reload schema';
commit;
