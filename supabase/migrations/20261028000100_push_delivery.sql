begin;

-- The existing inbox is authoritative. A device subscription is private to one
-- active account; a second account must create a new browser subscription.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) between 20 and 2048 and endpoint like 'https://%'),
  p256dh text not null check (char_length(p256dh) between 40 and 180),
  auth_secret text not null check (char_length(auth_secret) between 16 and 100),
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  disabled_at timestamptz
);
create index push_subscriptions_active_user_idx on public.push_subscriptions(user_id) where active;
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from public,anon,authenticated;
grant all on public.push_subscriptions to service_role;

create function public.register_push_subscription(
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

create function public.push_subscription_status(p_endpoint text)
returns boolean language plpgsql stable security definer set search_path='' as $$
begin
  if activity_private.active_kind() is null or p_endpoint is null or char_length(p_endpoint)>2048 then
    raise exception 'Subscription is unavailable.' using errcode='42501';
  end if;
  return exists(select 1 from public.push_subscriptions s where s.endpoint=p_endpoint
    and s.user_id=auth.uid() and s.active and (s.expires_at is null or s.expires_at>now()));
end $$;

create function public.disable_push_subscription(p_endpoint text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if activity_private.active_kind() is null or p_endpoint is null or char_length(p_endpoint)>2048 then
    raise exception 'Subscription is unavailable.' using errcode='42501';
  end if;
  update public.push_subscriptions set active=false,disabled_at=coalesce(disabled_at,now()),updated_at=now()
    where endpoint=p_endpoint and user_id=auth.uid();
  if not found then raise exception 'Subscription is unavailable.' using errcode='42501'; end if;
  return true;
end $$;

-- Leases make crashes recoverable. A provider may accept a message before a
-- crash is recorded, so visual exactly-once delivery is not promised.
alter table public.notification_outbox
  add column claim_token uuid,
  add column lease_until timestamptz,
  add column next_attempt_at timestamptz not null default now(),
  add column attempt_count integer not null default 0 check(attempt_count>=0),
  add column expires_at timestamptz,
  add column recipients_snapshotted_at timestamptz,
  add column outcome text check(outcome in ('accepted','no_subscriptions','expired','failed'));
update public.notification_outbox set expires_at=created_at+interval '24 hours';
alter table public.notification_outbox alter column expires_at set not null,
  alter column expires_at set default (now()+interval '24 hours');
create index notification_outbox_due_idx on public.notification_outbox(next_attempt_at,id)
  where processed_at is null;

create table public.push_deliveries (
  id bigint generated always as identity primary key,
  outbox_id bigint not null references public.notification_outbox(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  state text not null default 'pending' check(state in ('pending','accepted','permanent','expired')),
  attempt_count integer not null default 0 check(attempt_count>=0),
  next_attempt_at timestamptz not null default now(),
  last_status integer,
  last_error_class text check(last_error_class is null or last_error_class in
    ('gone','rejected','rate_limit','provider_unavailable','network','invalid_endpoint','disabled','retry_exhausted')),
  accepted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(outbox_id,subscription_id)
);
create index push_deliveries_pending_idx on public.push_deliveries(outbox_id,next_attempt_at)
  where state='pending';
alter table public.push_deliveries enable row level security;
revoke all on public.push_deliveries from public,anon,authenticated;
grant all on public.push_deliveries to service_role;
revoke all on sequence public.push_deliveries_id_seq from public,anon,authenticated;
grant usage,select on sequence public.push_deliveries_id_seq to service_role;

revoke all on function public.register_push_subscription(text,text,text,timestamptz),
  public.push_subscription_status(text),public.disable_push_subscription(text)
  from public,anon,authenticated;
grant execute on function public.register_push_subscription(text,text,text,timestamptz),
  public.push_subscription_status(text),public.disable_push_subscription(text)
  to authenticated;
notify pgrst,'reload schema';
commit;
