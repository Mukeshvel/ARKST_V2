# Local identity verification

## Milestone 2.1 observed local environment (2026-10-27)

The CLI is installed as a project dev dependency at stable version 2.122.0. Docker
Desktop 4.97.0 / Engine 29.9.2 exposes 3.665 GiB RAM. A supported `supabase start
--exclude realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,
logflare,vector,supavisor` invocation brought up healthy PostgreSQL 17, Auth, PostgREST
and Kong services with normal health checks. Realtime's image was pulled during startup
but its container was explicitly stopped/excluded. The four running containers used
about 275 MiB at the final sample. No memory-limit changes or experimental CLI features.

The 36 pgTAP assertions passed against this isolated stack. The real Auth suite then
failed at initial email/password sign-in with `email_provider_disabled`: the current
`auth.email.enable_signup = false` disables the email provider. The separate global
`auth.enable_signup = false` also remains set. No provider-config adjustment was made
because automatic review requested user approval. Until it is approved, real app/Auth
integration is unverified. See PROJECT_STATUS.md for the full command/result record.

## Current evidence and prerequisites

At Milestone 2 inspection, `docker`, `supabase` and `psql` were not available on PATH,
and the standard Docker installation directory was absent. No system-level tools
were installed, no remote database was accessed, and no database/auth tests have been
claimed as passing. The SQL below is implemented source pending execution on a real
isolated Supabase stack. Check PROJECT_STATUS for the final verification record.

A running, user-approved Docker-compatible container runtime and a supported Supabase
CLI are prerequisites. Follow the official [local development guide](https://supabase.com/docs/guides/local-development)
after approving any system installation. Record `docker version` and `supabase --version`
when enabling this environment. Do not use a remote database as a substitute.

## Local stack

Run from this repository, after the prerequisites are available:

```sh
supabase start
supabase db reset --local
supabase test db --local
supabase status
```

`db reset --local` deletes and recreates this project's local database; it is intended
only for this isolated development project. Preserve local work before resetting.
The project ID is `arkst-v2-identity-local`; API/DB/Studio ports are 54321/54322/54323.
Keep local ports restricted to the development machine. Do not run `supabase link`,
`db push`, use `--linked`, or supply a remote `--db-url` in this milestone.

Use the local API URL and public key shown by `supabase status` in ignored local
environment files. Do not paste service-role keys into the application environment
or browser. The separate integration harness requires an isolated local admin key
only to provision and remove test accounts. See its explicit environment checks
and PROJECT_STATUS for commands and results.

No seed runs automatically. Public email signup, anonymous signin and manual account
linking are disabled. Password sign-in is for administrator-created local test users.
Email confirmations remain enabled; a trusted test setup can create a local Auth user
with `email_confirm: true`. This is real Supabase Auth provisioning, not a fake session.
No Google OAuth provider or redirect flow is configured or claimed to work.

## Database structure

`20261026000100_identity_foundation.sql` creates three tables in one transaction:

- `profiles`: one row per `auth.users.id`, display name, student/staff classification,
  teaching/non-teaching staff classification and active flag (default **false**).
- `scopes`: exact institution/department/section/group scope identifiers and optional
  parent references. No membership rules, inherited access or activity workflows.
- `responsibility_assignments`: many staff role/scope assignments with start/end times.
  A composite foreign key forbids assigning staff responsibilities to students.

Classification and responsibility are separate. A non-teaching staff account can hold
teacher, counselor and placement-coordinator responsibilities concurrently, subject to
trusted organizational policy. A name, email suffix, Auth metadata or frontend field
never provisions authority. There is deliberately no `auth.users` provisioning trigger.

Authenticated callers have SELECT privileges only, further restricted by RLS:
own active profile, own currently valid responsibilities, and their exact scopes.
No table privilege or RLS policy permits browser/API insertion, update or deletion,
even when an application `admin` role exists. An application admin is not PostgreSQL's
`service_role` and cannot bypass RLS. Inactive and unprovisioned identities both have
no visible profile; the app must describe that denial without claiming which hidden
state occurred. There are no anonymous SELECT grants.

Scope parents are descriptive only. Apart from direct self-parent prohibition and
root-institution checks, hierarchy shape is not validated in this milestone. Do not
add inherited scope permissions until cycle, valid-parent and ancestry rules are
implemented and tested. Group membership evaluation remains planned.

## Trusted provisioning

Only a trusted operator using the local Auth Admin API/local Studio and a privileged
database connection can create access. The application has no role-management API.
Create an Auth identity first, verify its identity out of band, then insert the matching
profile with an explicitly approved classification and `is_active = true`. For staff,
insert one responsibility row per approved role/scope. Do not derive role grants from
user metadata or copy values submitted by a browser into these tables.

Example shape for a trusted local SQL session (placeholders are not executable values):

```sql
begin;
insert into public.profiles
  (id, display_name, account_kind, staff_classification, is_active)
values
  ('AUTH_USER_UUID', 'Local test staff', 'staff', 'non_teaching', true);

-- Use a scope created and approved by the trusted operator.
insert into public.responsibility_assignments (user_id, role, scope_id)
values
  ('AUTH_USER_UUID', 'teacher', 'APPROVED_SCOPE_UUID'),
  ('AUTH_USER_UUID', 'counselor', 'APPROVED_SCOPE_UUID'),
  ('AUTH_USER_UUID', 'placement_coordinator', 'APPROVED_SCOPE_UUID');
commit;
```

To disable application access, a trusted operator sets `profiles.is_active = false`.
To revoke one responsibility, set its `ends_at` to the current instant (after its
`starts_at`) or remove that row. No existing JWT claim embeds these assignments;
queries re-evaluate database state. Database owner/service-role access is powerful:
production provisioning tooling, approval/audit trails, recovery, retention and
administrative key handling still require a separate reviewed design.

## Test boundaries

`supabase/tests/database/identity_rls.test.sql` uses pgTAP, inserts transaction-local
database fixtures, and sets PostgreSQL request claim context to exercise RLS and grants.
It covers own-profile isolation, anonymous access, multiple responsibilities, expiry,
inactive/unprovisioned identities, scope isolation, self-escalation and staff-only
constraints. It rolls back all fixtures and test-helper privileges.

These are real SQL policy tests **when run on PostgreSQL**, but they do not test password
verification, JWT signatures, cookies or session revocation. The separate application
integration suite must authenticate through genuine local Supabase Auth and exercise
HTTP requests and direct database API requests. Neither suite may be reported as
passed until actually executed. Unit-test stubs are not substitutes for either suite.

The migration is forward-only. For this disposable local environment, reset/reapply
is the recovery path. A production rollback/backup procedure and production deployment
are outside this milestone.

References: [RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security),
[database testing](https://supabase.com/docs/guides/database/testing), and
[CLI configuration](https://supabase.com/docs/guides/local-development/cli/config).
