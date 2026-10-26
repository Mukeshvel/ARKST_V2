# Project status — Milestone 2, 2026-10-26

**Identity implementation is authored; live Auth/PostgreSQL/RLS verification is blocked.**
This is not production-ready software. Docker, Supabase CLI, psql and Podman were
not found (including the usual Docker executable path). No system tools were installed,
no remote database was contacted, and no migrations, deployment, commits or pushes occurred.

## Baseline inspection and preserved work

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

All eight required scenarios have executable integration coverage, but remain **unrun**:
valid own profile; unauthenticated denial with configured Auth; A cannot read B;
self-assignment of counselor/coordinator/HOD/admin denied; inactive/unprovisioned denial;
invalid credentials/session; logout denies subsequent cookie-session access; visible
real database failure. The suite has 11 check groups, also covering metadata tampering,
multiple staff responsibilities and cross-origin requests.

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

Obtain approval before installing Docker/CLI system prerequisites, or use an already
approved isolated development machine. Then follow LOCAL_SUPABASE.md and run both
real suites; fix all failures before considering identity verified. Do not connect a
remote production database as a substitute.

Confirm trusted provisioning ownership, future Google tenant/account-linking policy,
role delegation policy, retention/audit requirements and whether simultaneous
student-and-staff accounts are needed (current profile kind is exclusive). Future
academic permission proposals remain provisional. Stop here: Milestone 3 is not started.

## Git summary

No commits/index baseline exists, so `git diff --stat` is empty despite new/modified
untracked files. All files remain available for review; nothing was committed or pushed.
At review time there are 49 nonignored project files versus 25 after Milestone 1.
Existing core rule files are preserved; no old repository was touched.
