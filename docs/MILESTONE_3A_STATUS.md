# Project status — Milestone 3A, 2026-10-27

The shared PostgreSQL Activity API is implemented and locally verified. Final checks
passed 89 SQL assertions, 12 identity integration groups and 16 Activity integration
groups, including the 130-student SQL case and updated status-page smoke checks.
Milestone 3B has not started. This is local verification, not production readiness.

## Baseline and preservation

Started clean at dc7ba86 (`2.1 - docker works`) on main, matching origin/main. Read the
architecture, domain, permissions, decisions, project status, identity implementation,
config, migration and tests. No repository AGENTS.md was found. No dependencies changed.

The identity migration/policies, Auth configuration, identity implementation and its
36 SQL assertions/12 integration groups are unchanged. Proxy adds Activity routes to
session refresh/private headers. The foundation page has updated status text only.
Prior status is preserved in MILESTONE_2_1_STATUS.md as historical evidence.

## Implementation

Migration 20261027000100_activity_engine.sql adds seven tables: categories, exact
student scope memberships, explicit staff capabilities, activities, assignments,
one completion per assignment and authenticated actor/timestamp history.

The API creates activities and direct assignments atomically, lists visible activities
and history with pagination, accepts student completion reports and supports optional
staff verification. All app operations use the caller's session/public key. Initial
categories are assignment, weekly_test, nptel, seminar, mini_project, placement, general;
operators can extend categories without separate tables or workflow branches.

No role automatically grants authority. A trusted operator must approve capability rows
for a specific current responsibility/category and department/section scope. Every target
must have an active student profile and current exact-scope membership. No hierarchy,
metadata-based authority, group simulation or standing staff grants were introduced.

Date windows are configurable: start < deadline <= end; submission is start-inclusive
and deadline-exclusive using database time. Required verification stays reported until
an approved reviewer verifies. Unique completion keys and assignment row locks prevent
duplicates; repeated/invalid transitions return 409. Writes and history commit together.
Direct client table writes are revoked; read RLS filters each table independently.

See [ACTIVITY_ENGINE](ACTIVITY_ENGINE.md) for API payloads, provisioning, states, errors,
security boundaries, test execution and limitations.

## Commands and actual results

Commands ran from C:\RMK\Git Projects\ARKST V2. The sandbox-only docker ps initially
failed with named-pipe permission denied; authorized Docker access succeeded.

| Command                                                                                        | Result                                                                                                                                    |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| git status --short --branch; git log -1 --oneline                                              | Clean baseline dc7ba86 on main; no commits/pushes in 3A.                                                                                  |
| docker ps --format 'table {{.Names}}\t{{.Status}}'                                             | Existing Postgres, Auth and Kong healthy; PostgREST running.                                                                              |
| docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}'                             | Initial sample: REST 54.13, Auth 14.91, Kong 101.4, DB 76.29 MiB; about 247 MiB total, Docker limit 3.665 GiB.                            |
| $env:SUPABASE_HOME=Join-Path (Get-Location) '.supabase-home'; npx supabase migration up --help | Confirmed installed CLI's --local target.                                                                                                 |
| npx supabase migration up --local                                                              | New Activity migration applied; identity migration/volume preserved, no reset.                                                            |
| npm run format; npm run check                                                                  | First check stopped on Activity test-script formatting; no tests counted as passed.                                                       |
| npx prettier --write scripts/test-local-activities.mjs; npm run check                          | Passed formatting, TypeScript, zero-warning lint, 76 Vitest tests (59 existing + 17 new), 10 existing guard tests and production build.   |
| $env:SUPABASE_HOME=Join-Path (Get-Location) '.supabase-home'; npm run test:rls                 | Initial 85 assertions passed: 36 identity + 49 Activity, 2 files. Four bulk-target assertions added for final run.                        |
| $env:APP_ENV='local'; $env:LOCAL_IDENTITY_TESTS='1'; npm run test:local                        | Passed real production HTTP smoke (anonymous /api/me=401), 12 identity groups, 16 Activity groups. Test app stopped and fixtures cleaned. |

### Final verification after all implementation changes

| Command                                                                        | Final result                                                                                                                                      |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm run format; npm run check                                                  | Passed format, typecheck, lint, all 76 Vitest tests, all 10 guard tests and production build.                                                     |
| $env:SUPABASE_HOME=Join-Path (Get-Location) '.supabase-home'; npm run test:rls | **PASS: 2 files, 89 assertions: 36 identity + 53 Activity.** Includes the 130-target transaction and isolation checks.                            |
| $env:APP_ENV='local'; $env:LOCAL_IDENTITY_TESTS='1'; npm run test:local        | **PASS: updated production smoke + 12 real identity groups + 16 real Activity groups**, with no failed/skipped assertions. Temporary app stopped. |
| npm audit --audit-level=low                                                    | Exit 0, zero reported vulnerabilities; no dependency changes.                                                                                     |
| npm ls --all --json                                                            | Exit 0, valid dependency tree.                                                                                                                    |
| docker ps; docker stats --no-stream; docker inspect                            | Postgres/Auth/Kong healthy, REST running; all four OOMKilled=false. Final total about 282 MiB of 3.665 GiB.                                       |
| Local psql fixture-count query via docker exec                                 | Zero generated Auth users, activities, assignments, completions, history, capabilities, memberships and test failure schemas.                     |

Final per-container memory sample: REST 65.38 MiB, Auth 17.64 MiB, Kong 108.7 MiB,
DB 90.17 MiB. No memory shortage, runtime replacement or WSL limit changes occurred.
Local Supabase remains running; the ephemeral test app was stopped. This read-only
cleanup query was executed through docker exec against the local container:

```sql
select 'generated_auth_users' as object, count(*) from auth.users where email like 'arkst-%@example.test'
union all select 'activities', count(*) from public.activities
union all select 'assignments', count(*) from public.activity_assignments
union all select 'completions', count(*) from public.activity_completions
union all select 'history', count(*) from public.activity_history
union all select 'capabilities', count(*) from public.activity_capabilities
union all select 'memberships', count(*) from public.student_scope_memberships
union all select 'failure_schemas', count(*) from pg_namespace
where nspname like 'activity_test_%' or nspname like 'identity_test_%';
```

The malformed-cookie identity test intentionally emits SSR decode warnings and checks 401. Injected real database failures log SQLSTATE 58000 and return 503; independent
queries confirm rollback, followed by successful recovery. pgTAP emits the existing
optional pg_net/pg_cron grant warnings. No Auth/Activity integration assertion failed.

## Verification coverage

Authorized and unauthorized creation; atomic target validation; scope/category/hierarchy
and combined-role isolation; student-only assignments/completions/history; forged actor
and state rejection; direct REST/RPC enforcement; concurrent duplicate submission;
persistence after fresh login/read; required review and invalid transitions; date,
request-size, duplicate-target and CSRF validation; inactive/expired authorization;
real read/audit-write database failures, rollback and recovery; category extension and
pagination. All existing identity security scenarios passed unchanged.

The SQL suite separately checks grants, RLS, fixed definer search paths, constraints,
state transitions and exact time boundaries. Its added 130-student publication case
checks assignment/history counts and one student's isolation. This is not a concurrent
130-student/50-staff load test. SQL role contexts are not claimed as Auth verification.

Only generated example.test users and isolated records were used. SQL fixtures roll
back; integration cleanup removes generated accounts, scopes, records and failure hooks.
Local keys stay in process memory; the app receives no service-role key or owner URL.
No remote Supabase, external database, real college records or deployment was used.

## Changed files

- Database: supabase/migrations/20261027000100_activity_engine.sql;
  supabase/tests/database/activity_security.test.sql.
- API: src/app/api/activities/route.ts; src/app/api/activities/[id]/route.ts;
  src/app/api/activities/[id]/history/route.ts;
  src/app/api/activity-assignments/[id]/submit/route.ts;
  src/app/api/activity-assignments/[id]/verify/route.ts.
- Boundaries: src/auth/activity-http.ts; src/data/activities.ts;
  src/core/activity-input.ts; src/core/activity-input.test.ts; src/proxy.ts.
- Verification: scripts/test-local-activities.mjs; scripts/run-local-verification.mjs;
  scripts/smoke.mjs; package.json (scripts only).
- Documentation/status: README.md; docs/ACTIVITY_ENGINE.md; docs/ARCHITECTURE.md;
  docs/DOMAIN_MODEL.md; docs/PERMISSIONS.md; docs/DECISIONS.md; docs/LOCAL_SUPABASE.md;
  docs/PROJECT_STATUS.md; docs/MILESTONE_2_1_STATUS.md; src/data/README.md;
  src/app/page.tsx (status copy only).

## Limits and next steps

No group/dynamic targeting, recurrence, dashboards, notifications, counselor oversight
workflow, follow-up, catch-up, edits/cancellation, evidence, return/resubmit or
administrative/delegation tooling. Unsupported fields/targeting modes fail explicitly.
Before real use, approve the college capability matrix, student membership source,
deadline/late-work policy, review ownership and retention.

Staff capability allows Activity reads throughout its exact scope/category, including
other creators' activities there; no broad roster/profile access. Students retain existing
assignments after membership expiry. New transactions re-evaluate authorization;
concurrent operator revocation does not cancel an already authorized transaction.
History is append-only for app users, but database owners/service-role can bypass RLS.
Operator provisioning lacks a dedicated audit workflow. Create has no idempotency key;
ambiguous network results require reload before retrying. Completion uniqueness remains.

No full concurrent-load, hosted OAuth/infrastructure, browser/accessibility, refresh
rotation or stolen-token replay verification. Copied JWTs may remain valid until expiry
after logout; no immediate denylist. No production-readiness claim is made.

There are 12 modified tracked files and 15 new files, with nothing staged. Preserve
dc7ba86 and review this diff as a separate 3A checkpoint. No commit, push, remote
migration, WSL memory change, experimental infrastructure or Milestone 3B work occurred.
