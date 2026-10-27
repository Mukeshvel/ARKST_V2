# Project status — Milestone 2.1, 2026-10-27

**Local identity foundation verified:** 36 real database policy assertions and 12 real
Auth/application integration groups passed. Milestone 3 has not started.

## Milestone 2.1 verification (2026-10-27)

Inspected current Git state, all project docs, identity migration, Supabase tests,
integration harness, package setup and CLI availability. The 49 project files previously
described as untracked are now present in the reviewed baseline commit
`02c2707` (`foundation completed + initial Database code implemented`); `main` matches
`origin/main`. This turn modifies `.gitignore`, this status file, `docs/LOCAL_SUPABASE.md`,
`docs/IDENTITY_TESTS.md`, `package.json`, `package-lock.json`, `supabase/config.toml`
and `scripts/test-local-identity.mjs`; there are no staged or untracked files. The
baseline is a good checkpoint. Keep these verification changes in a separate reviewable
commit; no commit or push was made in this turn.

Docker Desktop 4.97.0, Docker Client/Server 29.9.2, WSL2, 12 CPUs. Docker reports
3,935,092,736 bytes (3.665 GiB) available, matching the supplied limit. No containers
or images were present before this work. `docker ps -a`, `docker info` and initial image
checks confirmed this. Supabase CLI 2.122.0 is pinned as a project-local dev dependency.
The normal CLI home path was inaccessible in the sandbox, so `SUPABASE_HOME` was
pointed to ignored `.supabase-home/` inside the repository; no user profile data was
changed. Docker access required elevated tool execution; user authorized this local
verification. No remote project was linked or contacted.

| Command/check                                                                                                                    | Actual result                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm install --save-dev --save-exact supabase@2.122.0`                                                                           | Passed; exact stable CLI installed locally.                                                                                                                                                                                                                                                                                                                                   |
| `npx supabase --version`                                                                                                         | Passed: 2.122.0. First help attempt without a writable SUPABASE_HOME failed with EPERM for `C:\Users\HP\.supabase`; using ignored repo-local SUPABASE_HOME resolved it.                                                                                                                                                                                                       |
| `npx supabase start --exclude realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor` | Startup succeeded with CLI health checks enabled, no `--ignore-health-check`, no experimental feature. PostgreSQL, GoTrue Auth, PostgREST and Kong were healthy/running. Realtime image was also pulled by the CLI but its container was stopped/excluded. Image pulls: Postgres 1.7 GB, Realtime 559 MB, Kong 203 MB, Auth 94 MB, PostgREST 41 MB, plus pg_prove test image. |
| Docker memory during normal startup                                                                                              | No resource failure. Once running, measured DB ~85 MiB, Auth ~14 MiB, Kong ~136 MiB, PostgREST ~26 MiB (about 261 MiB total of 3.665 GiB at that sample).                                                                                                                                                                                                                     |
| Initial local migration application                                                                                              | CLI reported `Applying migration 20261026000100_identity_foundation.sql...`; no SQL error. pgTAP below independently exercised the resulting schema.                                                                                                                                                                                                                          |
| `npm run test:rls` / `npx supabase test db --local`                                                                              | **Passed twice: 36 pgTAP assertions per run.** Both outputs: `All tests successful`, `Files=1, Tests=36`, `Result: PASS`. Two harmless grants warnings for optional `pg_net`/`pg_cron` helper functions came from test setup. The second run was after the preserved-volume restart.                                                                                          |
| Initial `node scripts/test-local-identity.mjs`                                                                                   | Failed before the first check: real Supabase Auth returned HTTP 422 `email_provider_disabled`. This revealed local email provider sign-in had been disabled in config. The harness cleaned generated users, scope and staff roles.                                                                                                                                            |
| Approved local config correction and restart                                                                                     | User approved enabling `auth.email.enable_signup` while keeping global `auth.enable_signup=false`. `supabase stop` reported `backup=true`; `supabase start` restored that database and passed standard health checks. No database reset.                                                                                                                                      |
| `node scripts/test-local-identity.mjs` with real local settings and an ephemeral production Next server                          | **Passed all 12 groups against genuine local Auth, PostgreSQL/PostgREST and HTTP.** Includes a real signup attempt rejected with `signup_disabled`, actual password sign-in, cookies, RLS isolation, role-write denial, database failure and logout. Harness deleted generated accounts/scope and temporary failure policy.                                                   |
| Bare `npm run test:identity`                                                                                                     | As designed, exits 1 with `BLOCKED` without explicit isolated-local environment. It ran successfully above when process-only local settings were supplied.                                                                                                                                                                                                                    |
| `npm run check`                                                                                                                  | Passed after final harness/config changes: format, typecheck, lint, 59 Vitest tests, 10 local-guard tests and production build.                                                                                                                                                                                                                                               |
| `$env:SMOKE_ORIGIN='http://127.0.0.1:3100'; npm run test:smoke`                                                                  | Passed against production build: foundation page, no student API, anonymous identity denied with 503/no private data.                                                                                                                                                                                                                                                         |
| `npm audit --audit-level=low`                                                                                                    | Sandbox attempt failed on registry DNS. Approved network retry passed: zero reported vulnerabilities.                                                                                                                                                                                                                                                                         |
| `npm ls --all --json`                                                                                                            | Exit 0; required dependency tree valid.                                                                                                                                                                                                                                                                                                                                       |

Supabase CLI startup printed generated local demo keys in its status output. They are
local-only credentials, were not copied to repository files, and the stack was bound to
loopback. No user-provided or remote credentials were used. The service-role key was held
only in process memory for isolated fixture setup and never passed to the app.

Current local stack remains running with the same preserved DB volume and migration.
Only synthetic `example.test` accounts were created; the harness cleaned them all. No
personal/college data is present. Memory remained within the Docker limit; no WSL change
or alternate runtime was needed.

## Remaining Milestone 2.1 test state

The required identity scenarios passed against real local services, including direct REST
RLS enforcement and app session checks. Actual public signup was attempted and rejected
with `signup_disabled` while password sign-in for Admin-created test users worked. No
fake sessions, mocked database or hardcoded identity were used.

## Pre-Milestone-2 baseline (2026-10-26; superseded by the current verification above)

Identity implementation was authored; live Auth/PostgreSQL/RLS verification was blocked.
This is not production-ready software. Docker, Supabase CLI, psql and Podman were
not found (including the usual Docker executable path). No system tools were installed,
no remote database was contacted, and no migrations, deployment, commits or pushes occurred.

## Pre-Milestone-2 inspection and preserved work (2026-10-26)

Read all prior docs, source/config/tests, dependency versions and Git status. The
repository still had no commits and all 25 Milestone 1 files were untracked. Existing
core rules and tests remain unchanged. The old status is preserved in MILESTONE_1_STATUS.md.

Resolved documentation/design differences: auth/data are now real code boundaries;
future academic permission proposals do not grant current access. Application admin
has no RLS bypass or role-edit endpoint. Staff classification is a profile field,
separate from multiple responsibility rows. Users are provisioned by a trusted operator,
not automatically by a signup trigger or email/metadata role inference.

## Implemented files and data flow

- `src/auth`: server-only Supabase SSR cookie client, verified claims plus current
  Auth user lookup, bounded credentials, exact Origin checks and sanitized failures.
- `src/data/identity.ts`: own active profile and current responsibilities read through
  the user's session. Database errors are returned as errors, never empty success.
- `src/proxy.ts`: Next.js 16 refresh path forwards changed cookies to request/response;
  protected routes independently verify identity. Private/no-store response headers.
- `src/app/login`, `auth/login`, `auth/logout`, `profile`, `api/me`: local password
  login, logout and protected own-profile UI/API. No operational academic dashboard.
- `src/config/identity.ts`: complete explicit service settings, loopback-only local
  mode, HTTPS hosted mode, and secret/service-role key rejection. Application uses
  no service-role key and no browser Supabase client.
- `supabase/migrations/20261026000100_identity_foundation.sql`: profiles linked to
  auth.users, descriptive scopes and many staff responsibilities. Constraints, indexes,
  explicit grants, RLS and deny-by-default writes. No activity/group workflows.
- `supabase/config.toml`: isolated local stack; signup and anonymous login disabled,
  refresh rotation enabled, 900-second access JWT lifetime. Config is not live-tested.
- `supabase/tests/database/identity_rls.test.sql`: 36 authored pgTAP assertions using
  explicit PostgreSQL role/claim contexts. These are not genuine authentication sessions.
- `scripts/test-local-identity.mjs`, `tests/integration`: genuine local Auth/HTTP/REST
  suite with generated accounts, restricted loopback endpoints and cleanup. No mocks.
- README, environment example, ignore rules and docs updated for reproducible handoff.

Profiles are active/inactive database records; an authenticated user without a profile
is unprovisioned. Both are denied with a generic message to avoid exposing hidden row
state. Only authenticated users can read their own active profile. Responsibilities
must belong to staff, be current and match the caller. Exact scope rows are visible
only through those responsibilities. All client INSERT/UPDATE/DELETE privileges are
revoked, including for users labeled admin. Role assignments are never browser inputs.

## Verification evidence

Environment: Windows, Node 24.19.0, npm 11.17.0. No real college records or credentials.

| Command/check                                                                                         | Actual outcome                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm install --save-exact @supabase/ssr@0.12.7 @supabase/supabase-js@2.118.0 server-only@0.0.1`       | Passed.                                                                                                                                                                                                     |
| `npm install --save-dev --save-exact pg`                                                              | Passed; pinned 8.23.1. Used only for real local database tests.                                                                                                                                             |
| `npm run typecheck`                                                                                   | Initial CookieOptions/name typing failure corrected to CookieOptionsWithName; rerun passed.                                                                                                                 |
| `npm run lint`                                                                                        | Passed, zero warnings.                                                                                                                                                                                      |
| `npm test`                                                                                            | Passed: 59 Vitest pure tests plus 10 Node local-test guard tests; these do not test real authentication.                                                                                                    |
| `npm run build`                                                                                       | Passed: static foundation, dynamic identity routes and Next 16 Proxy.                                                                                                                                       |
| `npm run format` / `npm run format:check`                                                             | Formatting applied and checked.                                                                                                                                                                             |
| `npm start -- --hostname 127.0.0.1 --port 3100`                                                       | Production server started on loopback.                                                                                                                                                                      |
| `$env:SMOKE_ORIGIN='http://127.0.0.1:3100'; npm run test:smoke`                                       | Passed against real local HTTP server: foundation HTML, no operational controls, absent student API, unconfigured identity 503/no profile/private no-store. This is not successful authentication evidence. |
| `npm run test:identity`                                                                               | Exit 1, BLOCKED by missing explicit local stack/test configuration. Zero real checks executed.                                                                                                              |
| `npm run test:rls`                                                                                    | Failed: supabase CLI not found. Zero SQL assertions executed.                                                                                                                                               |
| `node --check scripts/test-local-identity.mjs` and `node --check tests/integration/local-helpers.mjs` | Syntax passed; no database execution implied.                                                                                                                                                               |
| `npm ls --all --json`                                                                                 | Exit 0, no invalid required dependency peers.                                                                                                                                                               |
| `npm audit --audit-level=low`                                                                         | Zero reported vulnerabilities at verification time; not a security certification.                                                                                                                           |
| Credential-pattern scan and manual review                                                             | No actual credentials found. One match is an intentionally rejected `sb_secret_never_accepted` unit-test string.                                                                                            |
| Git/ignore review                                                                                     | Dependencies, build output, local environment and Supabase temporary state ignored. No tracked generated files.                                                                                             |

Static security review checked the migration/session/route code and found no obvious
cross-user bypass. It found the corrected cookie typing issue and a misleading logout
retry message, which was corrected. Static review is not RLS/Auth execution evidence.

## Mandatory real-test status

The required scenarios were exercised against the isolated local stack: valid own
profile; anonymous denial; cross-user isolation; client role-write denial; inactive and
unprovisioned denial; invalid credentials/cookies; logout access denial; and visible
database failure/recovery. The 12 groups also cover signup disabled, metadata escalation,
multiple staff responsibilities and CSRF. The 36 SQL/RLS assertions passed separately.

The database-failure test creates a temporary restrictive policy raising a real exception
only for its generated user. It removes the policy, function, schema, users and scope
in cleanup. Explicit local opt-in is required; do not use a tunnel to a remote DB.
See IDENTITY_TESTS.md for limitations and recovery after forced termination.

## Dependencies and stability

New exact runtime versions: @supabase/supabase-js 2.118.0 (Auth/data SDK), @supabase/ssr
0.12.7 (cookie session integration), server-only 0.0.1 (server import boundary).
New dev version: pg 8.23.1 (integration setup/controlled DB failure). Existing Next
16.4.3, React/React DOM 19.3.1, TypeScript 5.9.3 and lint/test tools remain pinned.
Supabase documents its SSR package as beta with possible API changes; it is deliberately
pinned and its cookie/refresh behavior needs live regression tests before upgrades.
See DECISIONS.md for official guidance and full dependency purposes.

## Security limits / unverified behavior

- Migrations have not been parsed/applied by PostgreSQL; RLS, schema constraints,
  provisioning, genuine login and cookie rotation need actual isolated-stack tests.
- Hosted login, Google OAuth, public onboarding, password recovery and administrative
  provisioning/audit tooling are absent. Password login is local-development-only.
- Logout clears application cookies and requests current-session refresh revocation.
  Copied access JWTs may remain valid until expiry; no immediate global token denylist.
  A failed revocation returns 503 and accurately warns that local cookies were cleared.
- API failures have explicit 401/403/503 status; profile page errors show no private data
  but rendered error UI can have HTTP 200. Anonymous profile requests redirect to login.
- No browser automation, visual/accessibility/cross-browser tests, live token refresh,
  provider-outage tests, load tests or production readiness/security certification.
- No clean npm ci reinstall was performed. Package installation/tree/build were checked.
- Scope ancestry is descriptive, not authorization inheritance. Group membership,
  organization hierarchy validation and academic capabilities are still proposals.
- Supabase rate limits, hosted abuse protections, recovery and backup behavior need
  deployment-specific verification before any hosted authentication is enabled.

## Decisions and next action

Milestone 2.1 local verification is complete. Review the eight-file diff and commit it
as a separate checkpoint when ready. Do not connect a remote project or begin Milestone 3
as part of this verification.

Confirm trusted provisioning ownership, future Google tenant/account-linking policy,
role delegation policy, retention/audit requirements and whether simultaneous
student-and-staff accounts are needed (current profile kind is exclusive). Future
academic permission proposals remain provisional. Stop here: Milestone 3 is not started.

## Current Git summary

Baseline `02c2707` exists on `main` and matches `origin/main`. Eight unstaged tracked
files are changed for this verification. No files are staged, no files are
untracked, and no commit or push was made here. The app/core files and migration remain
otherwise unchanged; `.supabase-home/` is local ignored state.
