-- No auth.users trigger: signing up must never provision application access.
-- Trusted operators provision users separately after verifying identity.
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  account_kind text not null check (account_kind in ('student', 'staff')),
  staff_classification text check (staff_classification in ('teaching', 'non_teaching')),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  constraint profile_classification_matches_kind check (
    (account_kind = 'student' and staff_classification is null)
    or (account_kind = 'staff' and staff_classification is not null)
  ),
  unique (id, account_kind)
);

-- A scope is an exact assignment boundary, not an implicit hierarchy permission.
-- Parent/type hierarchy and membership workflows remain future work.
create table public.scopes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  kind text not null check (kind in ('institution', 'department', 'section', 'group')),
  parent_id uuid references public.scopes(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint scope_not_own_parent check (parent_id is distinct from id),
  constraint institution_has_no_parent check (kind <> 'institution' or parent_id is null)
);
create index scopes_parent_idx on public.scopes(parent_id);

create table public.responsibility_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  -- Composite FK enforces staff status without a privileged lookup function.
  staff_kind text not null default 'staff' check (staff_kind = 'staff'),
  role text not null check (role in (
    'teacher', 'counselor', 'coordinator', 'placement_coordinator',
    'branch_coordinator', 'hod', 'admin'
  )),
  scope_id uuid not null references public.scopes(id) on delete restrict,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  constraint responsibilities_staff_fk foreign key (user_id, staff_kind)
    references public.profiles(id, account_kind) on delete cascade,
  constraint valid_responsibility_interval check (ends_at is null or ends_at > starts_at),
  unique (user_id, role, scope_id, starts_at)
);
create index responsibilities_user_idx on public.responsibility_assignments(user_id);
create index responsibilities_scope_idx on public.responsibility_assignments(scope_id);

alter table public.profiles enable row level security;
alter table public.scopes enable row level security;
alter table public.responsibility_assignments enable row level security;

revoke all on public.profiles, public.scopes, public.responsibility_assignments
  from public, anon, authenticated;
grant select on public.profiles, public.scopes, public.responsibility_assignments
  to authenticated;
-- This key is ONLY for isolated fixture setup/trusted operators, never app requests.
grant select, insert, update, delete
  on public.profiles, public.scopes, public.responsibility_assignments to service_role;

create policy own_active_profile on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) and is_active);

create policy own_current_responsibilities on public.responsibility_assignments
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and starts_at <= now()
    and (ends_at is null or now() < ends_at)
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_active and p.account_kind = 'staff'
    )
  );

create policy scopes_of_own_current_responsibilities on public.scopes
  for select to authenticated
  using (
    exists (
      select 1 from public.responsibility_assignments r
      where r.scope_id = scopes.id and r.user_id = (select auth.uid())
    )
  );

-- No INSERT/UPDATE/DELETE policies, RPCs or frontend role-assignment mechanism.
-- A future migration must explicitly grant and authorize each new operation.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

commit;
