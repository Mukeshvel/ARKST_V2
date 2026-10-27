begin;

-- Authorization is explicitly provisioned, never inferred from a role name.
create schema if not exists activity_private;
revoke all on schema activity_private from public, anon, authenticated;
grant usage on schema activity_private to authenticated;

create table public.activity_categories (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{0,49}$'),
  label text not null check (char_length(btrim(label)) between 1 and 100)
);
insert into public.activity_categories (key, label) values
  ('assignment', 'Assignment'), ('weekly_test', 'Weekly test'), ('nptel', 'NPTEL'),
  ('seminar', 'Seminar'), ('mini_project', 'Mini project'),
  ('placement', 'Placement'), ('general', 'General');

-- Exact department/section membership; no group or parent traversal.
create table public.student_scope_memberships (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  student_kind text not null default 'student' check (student_kind = 'student'),
  scope_id uuid not null references public.scopes(id) on delete restrict,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (student_id, student_kind) references public.profiles(id, account_kind) on delete cascade,
  check (ends_at is null or ends_at > starts_at),
  unique (student_id, scope_id, starts_at)
);
create index student_membership_scope_idx on public.student_scope_memberships(scope_id, student_id);

create table public.activity_capabilities (
  responsibility_id uuid not null references public.responsibility_assignments(id) on delete cascade,
  category_key text not null references public.activity_categories(key) on delete restrict,
  can_create boolean not null default false,
  can_verify boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (responsibility_id, category_key),
  check (can_create or can_verify)
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  category_key text not null references public.activity_categories(key) on delete restrict,
  scope_id uuid not null references public.scopes(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text not null default '' check (char_length(description) <= 5000),
  starts_at timestamptz not null,
  deadline_at timestamptz not null,
  ends_at timestamptz not null,
  requires_verification boolean not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (isfinite(starts_at) and isfinite(deadline_at) and isfinite(ends_at)),
  check (starts_at < deadline_at and deadline_at <= ends_at)
);
create index activities_scope_category_idx on public.activities(scope_id, category_key);
create index activities_created_idx on public.activities(created_at, id);

-- A direct target is the durable assignment; future group expansion can use the same table.
create table public.activity_assignments (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  student_id uuid not null,
  student_kind text not null default 'student' check (student_kind = 'student'),
  assigned_at timestamptz not null default now(),
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  foreign key (student_id, student_kind) references public.profiles(id, account_kind) on delete restrict,
  unique (activity_id, student_id)
);
create index activity_assignments_student_idx on public.activity_assignments(student_id, activity_id);

create table public.activity_completions (
  assignment_id uuid primary key references public.activity_assignments(id) on delete cascade,
  state text not null check (state in ('reported', 'verified')),
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  verified_by uuid references public.profiles(id) on delete restrict,
  verified_at timestamptz,
  check ((state = 'reported' and verified_by is null and verified_at is null)
    or (state = 'verified' and verified_by is not null and verified_at is not null
      and verified_by <> submitted_by and verified_at >= submitted_at))
);

create table public.activity_history (
  id bigint generated always as identity primary key,
  activity_id uuid not null references public.activities(id) on delete cascade,
  assignment_id uuid references public.activity_assignments(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (action in ('created', 'assigned', 'reported', 'verified')),
  occurred_at timestamptz not null default now(),
  check ((action = 'created' and assignment_id is null)
    or (action <> 'created' and assignment_id is not null))
);
create index activity_history_activity_idx on public.activity_history(activity_id, id);
create index activity_history_assignment_idx on public.activity_history(assignment_id, id);

create function activity_private.active_kind() returns text
language sql stable security definer set search_path = '' as $$
  select p.account_kind from public.profiles p where p.id = auth.uid() and p.is_active
$$;

create function activity_private.can_manage(p_scope uuid, p_category text, p_operation text)
returns boolean language sql stable security definer set search_path = '' as $$
  select activity_private.active_kind() = 'staff' and exists (
    select 1 from public.responsibility_assignments r
    join public.activity_capabilities c on c.responsibility_id = r.id
    join public.scopes s on s.id = r.scope_id
    where r.user_id = auth.uid() and r.scope_id = p_scope
      and s.kind in ('department', 'section') and c.category_key = p_category
      and r.starts_at <= now() and (r.ends_at is null or now() < r.ends_at)
      and case p_operation when 'create' then c.can_create when 'verify' then c.can_verify
        when 'read' then (c.can_create or c.can_verify) else false end
  )
$$;

create function activity_private.can_read_activity(p_activity uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.activities a where a.id = p_activity and (
    activity_private.can_manage(a.scope_id, a.category_key, 'read')
    or (activity_private.active_kind() = 'student' and exists (
      select 1 from public.activity_assignments x where x.activity_id = a.id and x.student_id = auth.uid()
    ))
  ))
$$;

create function activity_private.can_read_assignment(p_assignment uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.activity_assignments x
    join public.activities a on a.id = x.activity_id where x.id = p_assignment and (
      (activity_private.active_kind() = 'student' and x.student_id = auth.uid())
      or activity_private.can_manage(a.scope_id, a.category_key, 'read')
    ))
$$;

alter table public.activity_categories enable row level security;
alter table public.student_scope_memberships enable row level security;
alter table public.activity_capabilities enable row level security;
alter table public.activities enable row level security;
alter table public.activity_assignments enable row level security;
alter table public.activity_completions enable row level security;
alter table public.activity_history enable row level security;

revoke all on public.activity_categories, public.student_scope_memberships,
  public.activity_capabilities, public.activities, public.activity_assignments,
  public.activity_completions, public.activity_history from public, anon, authenticated;
grant select on public.activity_categories, public.activities, public.activity_assignments,
  public.activity_completions, public.activity_history to authenticated;
-- No application roster, membership or capability provisioning endpoint.
grant all on public.activity_categories, public.student_scope_memberships,
  public.activity_capabilities, public.activities, public.activity_assignments,
  public.activity_completions, public.activity_history to service_role;
revoke all on sequence public.activity_history_id_seq from public, anon, authenticated;
grant usage, select on sequence public.activity_history_id_seq to service_role;

create policy categories_active on public.activity_categories for select to authenticated
  using ((select activity_private.active_kind()) is not null);
create policy activities_visible on public.activities for select to authenticated
  using (activity_private.can_read_activity(id));
create policy assignments_visible on public.activity_assignments for select to authenticated
  using (activity_private.can_read_assignment(id));
create policy completions_visible on public.activity_completions for select to authenticated
  using (activity_private.can_read_assignment(assignment_id));
-- Students see only their assignment events, not the roster or other students' history.
create policy history_visible on public.activity_history for select to authenticated
  using (case when assignment_id is not null then activity_private.can_read_assignment(assignment_id)
    else exists (select 1 from public.activities a where a.id = activity_id
      and activity_private.can_manage(a.scope_id, a.category_key, 'read')) end);

create function public.create_activity(
  p_category text, p_scope uuid, p_title text, p_description text,
  p_starts_at timestamptz, p_deadline_at timestamptz, p_ends_at timestamptz,
  p_requires_verification boolean, p_students uuid[]
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_activity uuid; v_actor uuid := auth.uid();
begin
  if not coalesce(activity_private.can_manage(p_scope, p_category, 'create'), false) then
    raise exception 'Activity creation is not permitted.' using errcode = '42501';
  end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 160
    or p_description is null or char_length(p_description) > 5000
    or p_requires_verification is null or p_starts_at is null or p_deadline_at is null or p_ends_at is null
    or not isfinite(p_starts_at) or not isfinite(p_deadline_at) or not isfinite(p_ends_at)
    or not (p_starts_at < p_deadline_at and p_deadline_at <= p_ends_at and now() < p_deadline_at)
    or p_students is null or cardinality(p_students) not between 1 and 500
    or array_ndims(p_students) <> 1 or array_position(p_students, null) is not null
    or cardinality(p_students) <> (select count(distinct x) from unnest(p_students) x) then
    raise exception 'Invalid activity input.' using errcode = '22023';
  end if;
  -- Reject the entire publication if any target lacks explicit, current membership.
  if exists (select 1 from unnest(p_students) target where not exists (
    select 1 from public.student_scope_memberships m join public.profiles p on p.id = m.student_id
    where m.student_id = target and m.scope_id = p_scope and p.is_active and p.account_kind = 'student'
      and m.starts_at <= now() and (m.ends_at is null or now() < m.ends_at)
  )) then
    raise exception 'One or more targets are not permitted.' using errcode = '42501';
  end if;
  insert into public.activities(category_key, scope_id, title, description, starts_at, deadline_at,
    ends_at, requires_verification, created_by)
  values (p_category, p_scope, btrim(p_title), p_description, p_starts_at, p_deadline_at,
    p_ends_at, p_requires_verification, v_actor) returning id into v_activity;
  insert into public.activity_assignments(activity_id, student_id, assigned_by)
    select v_activity, x, v_actor from unnest(p_students) x;
  insert into public.activity_history(activity_id, actor_id, action) values (v_activity, v_actor, 'created');
  insert into public.activity_history(activity_id, assignment_id, actor_id, action)
    select v_activity, id, v_actor, 'assigned' from public.activity_assignments where activity_id = v_activity;
  return v_activity;
end;
$$;

create function public.submit_activity(p_assignment uuid) returns public.activity_completions
language plpgsql security definer set search_path = '' as $$
declare v_assignment public.activity_assignments; v_activity public.activities;
  v_result public.activity_completions;
begin
  if activity_private.active_kind() is distinct from 'student' then
    raise exception 'Submission is not permitted.' using errcode = '42501';
  end if;
  select * into v_assignment from public.activity_assignments
    where id = p_assignment and student_id = auth.uid() for update;
  if not found then raise exception 'Assignment is unavailable.' using errcode = '42501'; end if;
  if exists (select 1 from public.activity_completions where assignment_id = p_assignment) then
    raise exception 'Completion already submitted.' using errcode = '23505';
  end if;
  select * into strict v_activity from public.activities where id = v_assignment.activity_id;
  -- No late/catch-up policy is invented. Deadline is exclusive; end can be later.
  if not (v_activity.starts_at <= now() and now() < v_activity.deadline_at and now() < v_activity.ends_at) then
    raise exception 'The submission window is closed.' using errcode = '22023';
  end if;
  insert into public.activity_completions(assignment_id, state, submitted_by)
    values(p_assignment, 'reported', auth.uid()) returning * into v_result;
  insert into public.activity_history(activity_id, assignment_id, actor_id, action)
    values(v_assignment.activity_id, p_assignment, auth.uid(), 'reported');
  return v_result;
end;
$$;

create function public.verify_activity(p_assignment uuid) returns public.activity_completions
language plpgsql security definer set search_path = '' as $$
declare v_assignment public.activity_assignments; v_activity public.activities;
  v_result public.activity_completions;
begin
  select * into v_assignment from public.activity_assignments where id = p_assignment for update;
  select * into v_activity from public.activities where id = v_assignment.activity_id;
  if not coalesce(activity_private.can_manage(v_activity.scope_id, v_activity.category_key, 'verify'), false)
    or v_assignment.student_id = auth.uid() then
    raise exception 'Verification is not permitted.' using errcode = '42501';
  end if;
  if not v_activity.requires_verification then
    raise exception 'This activity does not require verification.' using errcode = '22023';
  end if;
  update public.activity_completions set state = 'verified', verified_by = auth.uid(), verified_at = now()
    where assignment_id = p_assignment and state = 'reported' returning * into v_result;
  if not found then raise exception 'Only reported work can be verified once.' using errcode = '23505'; end if;
  insert into public.activity_history(activity_id, assignment_id, actor_id, action)
    values(v_assignment.activity_id, p_assignment, auth.uid(), 'verified');
  return v_result;
end;
$$;

revoke all on all functions in schema activity_private from public, anon, authenticated;
grant execute on all functions in schema activity_private to authenticated;
revoke all on function public.create_activity(text, uuid, text, text, timestamptz, timestamptz, timestamptz, boolean, uuid[]),
  public.submit_activity(uuid), public.verify_activity(uuid) from public, anon, authenticated;
grant execute on function public.create_activity(text, uuid, text, text, timestamptz, timestamptz, timestamptz, boolean, uuid[]),
  public.submit_activity(uuid), public.verify_activity(uuid) to authenticated;

comment on function public.create_activity is 'Atomic direct targeting; caller-derived actor; explicit scope/category capability and every student checked.';
comment on table public.activity_completions is 'No row = pending. reported counts as complete only if verification is not required. All writes use authorized RPCs.';
notify pgrst, 'reload schema';
commit;
