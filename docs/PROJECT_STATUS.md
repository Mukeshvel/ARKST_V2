# Project status — through Milestone 4, 2026-10-27

The earlier Milestone 3B-1 record below describes the directory and its targeted security correction. Milestone 3B-2A adds real section assignment and creator/counselor monitoring; its results are recorded at the end. No actual departmental roster or production accounts were imported or created. This is not production readiness.

## Baseline and preservation

Started at clean `2ac69a6` (`3A: SECURE ACTIVITY ENGINE`) on `main`. The M3A status and evidence are preserved in [MILESTONE_3A_STATUS.md](MILESTONE_3A_STATUS.md). Existing identity, Activity and their migrations were preserved. No remote Supabase, deploy, push or commit was used.

## Implementation

Migrations `20261027000200_department_directory.sql` and `20261027000300_directory_validation.sql` add a text-keyed student roster, effective-dated counselor mappings, self-editable staff directory profile, section preferences and actor/time audit records. Existing identity responsibilities, sections, student scope memberships and Activity capability model are reused. The Activity authorization rule permits an explicitly provisioned department-scoped create capability to target its direct sections; it does not grant unrelated student data access. Direct-student targeting remains the only Activity targeting mode.

The authenticated `/profile` editor saves teaching status, sections, subjects and descriptive designation through a cookie-authenticated route and a transaction using `auth.uid()`. Database policy validates the staff's existing responsibility and section scope, syncs the existing classification field, and records before/after state. Profile selections never change role or capability grants. Counselor access derives only from approved effective-dated counselor mappings and active counselor responsibility.

`scripts/directory-admin.mjs` is an explicit local-only operator tool with preview by default and transactional `--apply`: import an approved roster, import counselor mappings, or provision a role and explicit Activity capability for an already-existing confirmed Auth user. It creates no Auth users and refuses non-loopback database hosts. The admin role and database owner remain trusted operator boundaries. See [DEPARTMENT_DIRECTORY.md](DEPARTMENT_DIRECTORY.md).

## Verification commands and results

Commands were executed from the repository root using the running isolated local Supabase stack. All test records were synthetic and cleanup ran after integration suites.

| Command                                                                                | Result                                                                                                                            |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                                                                        | PASS after implementation: formatting, typecheck, lint, 88 Vitest tests, 10 helper safety tests and production build.             |
| `$env:SUPABASE_HOME=Join-Path (Get-Location) '.supabase-home'; npm run test:rls`       | PASS: 3 pgTAP files, 121 assertions, including Milestone 2 identity, Milestone 3A Activity and directory RLS/security regression. |
| `$env:APP_ENV='local'; $env:LOCAL_IDENTITY_TESTS='1'; npm run test:local -- directory` | PASS: smoke and 11 real directory integration groups against local Auth, HTTP, Postgres and RLS.                                  |
| `$env:APP_ENV='local'; $env:LOCAL_IDENTITY_TESTS='1'; npm run test:local -- identity`  | PASS: smoke and 12 real identity integration groups.                                                                              |
| `$env:APP_ENV='local'; $env:LOCAL_IDENTITY_TESTS='1'; npm run test:local -- activity`  | PASS: smoke and 16 real Activity integration groups, including unrelated department denial.                                       |
| `$env:APP_ENV='local'; $env:LOCAL_IDENTITY_TESTS='1'; npm run test:local`              | PASS: smoke, 12 identity, 16 Activity and 11 directory groups in one run; generated records were cleaned.                         |
| `git diff --check`                                                                     | PASS after documentation updates.                                                                                                 |

Directory coverage: nonconsecutive text identifiers; 4-row roster transaction; duplicate/invalid/unauthorized imports; counselor caseloads of 3 and 1; counselor-only mapped visibility; existing-confirmed-user staff provisioning; self-edit to non-teaching / both sections / custom designation / subjects; mapping stability; nonteaching placement; no self-granted roles; student/faculty cross-profile denial; validation and database failures. No records are fake-authenticated; test users sign in through local Supabase Auth.

### Failed checks and corrections

- One `npm run check` stopped at `prettier --check` after the status/docs update; the three reported Markdown files were formatted, and the full check then passed.
- An initial combined integration run under the default sandbox failed at the required Supabase CLI status/health lookup before tests started. Re-running with permitted Docker access completed the same health-gated runner; no checks were bypassed.
- Earlier focused directory runs exposed an invalid SQL parameter in counselor import and a suite selector that rejected `directory`. The parameterization and selector were corrected; final directory-only and combined suites both passed.
- One Activity regression fixture expected a same-department sibling section to be unauthorized even though the requested explicit department capability supports both direct sections. The fixture now tests denial across an unrelated department; the scoped denial check passed.
- The identity suite emits Supabase SSR diagnostics while deliberately testing malformed cookie rejection; the malformed session is denied and all 12 identity assertions pass.

## Limits and next steps

- Actual 124-student official roster and administrator-approved counselor mapping file have not been supplied or imported.
- CSV import is an operator CLI, not a browser admin workflow. The local database-owner URL plus approved admin responsibility is a privileged operational boundary and needs deployment-grade secret custody and operator procedures before production.
- Google OAuth is not configured or tested. Authentication remains the existing provider configuration.
- No production accounts were provisioned; only isolated synthetic local Auth users were used.
- Dynamic groups, group targeting, complete dashboards, notifications, follow-up and catch-up are not implemented. Group targeting is rejected rather than simulated.
- Administrative/HOD authority is still separately controlled; custom text and teaching status do not grant it. No institutional policies were invented.
- The sandboxed first combined run exited before tests because the Supabase CLI could not inspect Docker. With authorized local Docker access, the same required health-gated runner completed. No health gate was bypassed and no remote target was used.
- The installed CLI warns that `[inbucket]` is deprecated in favor of `[local_smtp]`; this did not fail local verification. pgTAP setup also emitted harmless optional `pg_net` and `pg_cron` privilege warnings.
- Final Docker sample: REST 69.32 MiB, Auth 19.05 MiB, Kong 124.7 MiB, Postgres 101.8 MiB (about 315 MiB total of 3.665 GiB). No WSL memory limits were changed.

## Targeted 3B-1 security correction — 2026-10-27

The read-only preservation review found a weakened SECURITY DEFINER assertion, ordinary
counselor access to inactive roster rows, no safe current-counselor replacement workflow,
and child-section read/verify fanout from a department Activity capability. Forward-only
migrations `20261027000400_directory_security_correction.sql` and
`20261027000500_directory_active_staff_mapping.sql` were applied to the existing local
database without reset. They retain historical counselor mappings and Activity rows.

The first migration rejects inconsistent existing directory relationships, enforces one
non-overlapping primary counselor interval per student with a GiST exclusion constraint,
guards roster department/section and mapped counselor role/scope relationships, hides
inactive roster rows from ordinary counselor monitoring, and confines department-to-child
Activity scope expansion to CREATE. Exact-scope 3A READ and VERIFY behavior remains.
The second migration also denies direct mapping-table reads to inactive staff. The local
operator CLI now previews or transactionally applies reassignment/revocation with roster
row locks, stable lock order and actor audit entries. No real roster was imported.

Focused directory integration passed 12 groups before the concurrent-write assertion was
added. Its first run with that assertion failed at the conflict-code check; the output
did not include the actual SQLSTATE, so that specific cause was unconfirmed. A diagnostic
was added and the assertion now accepts either an exclusion conflict (`23P01`) or an
exact-key duplicate (`23505`), while still requiring exactly one committed write and one
active mapping. The next focused run and final combined run passed.

| Correction verification command                                                                   | Actual result                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$env:SUPABASE_HOME=Join-Path (Get-Location) '.supabase-home'; npx supabase migration up --local` | Applied `00400` and then `00500` to the existing local database, without reset.                                                                                     |
| `npm run check`                                                                                   | PASS: formatting, typecheck, lint, 88 Vitest tests, 10 helper safety tests and production build.                                                                    |
| `$env:SUPABASE_HOME=Join-Path (Get-Location) '.supabase-home'; npm run test:rls`                  | PASS: 3 files, 146 pgTAP assertions, including identity, Activity, named SECURITY DEFINER functions, reviewed invoker, relationships and inactive counselor denial. |
| `$env:APP_ENV='local'; $env:LOCAL_IDENTITY_TESTS='1'; npm run test:local`                         | PASS: smoke, 12 identity, 16 Activity and 12 directory real Auth/HTTP/PostgreSQL/RLS groups; generated fixtures cleaned.                                            |

Directory regression confirms old counselor access ends after reassignment; new counselor
sees only mapped active students; inactive roster rows are absent from ordinary reads;
prior mapping rows and Activity rows remain; revocation removes current access; competing
inserts leave one active mapping. A department creator can publish separately to both
Section A and Section B
but cannot read/verify that child activity or browse private roster data from the create
grant alone. Existing completion and verification regression groups continue passing.

`git diff --check` passed and the tree remains unstaged on `main`. A read-only local
PostgreSQL count found zero `arkst-dir-*` Auth users, matching directory audit rows and
named placement test activities after the final suite.

## Milestone 3B-2A section assignment and monitoring — 2026-10-27

Started from clean approved commit `497a97d` on `main` and created the local
`codex/milestone-3b-2a` branch. At that verification point no commit or push was made;
the local `20d0d3c` checkpoint was created later before 3B-2B. Forward-only migration
`20261027000600_section_activity_monitoring.sql` was applied to the existing local
Supabase database with `npx supabase migration up --local`; no reset or remote access.

An authenticated creator now calls `POST /api/activities/sections` with the approved
department and Section A, B or both. The database validates current CREATE approval
for every selected section and snapshots only active, linked roster students with an
active profile and current exact-section membership into the existing assignment and
history tables. Creation returns assigned and excluded-roster counts. The creator's
`GET /api/activities/{id}/monitor` gives bounded results for that Activity while
current authority remains. `GET /api/counselor/activities` uses only current trusted
mapping, responsibility, active roster and student records to show the counselor's
students' work, including activities created by other staff. These reads use the same
completion table as student submission and reviewer verification. No separate
completion pool, group evaluator or production account provisioning was added.

The new table denies ordinary direct reads/writes. New privileged functions have
fixed empty search paths, authenticated-only grants, caller-derived identity and
named SECURITY DEFINER assertions. Existing direct Activity READ/VERIFY exact-scope
semantics remain; the creator's new section-snapshot result access is restricted to
their own publication and revoked with CREATE approval. CREATE does not grant general
roster access or verification. Counselor access grants neither CREATE nor VERIFY.

| Executed command                                                                                  | Result                                                                                                                                        |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `$env:SUPABASE_HOME=Join-Path (Get-Location) '.supabase-home'; npx supabase migration up --local` | PASS: applied `00600` to existing local DB without reset.                                                                                     |
| `$env:SUPABASE_HOME=Join-Path (Get-Location) '.supabase-home'; npm run test:rls`                  | PASS: 3 files, 160 pgTAP assertions.                                                                                                          |
| `npm run typecheck && npm run lint`                                                               | PASS after implementation.                                                                                                                    |
| `npm run build`                                                                                   | PASS; new production API routes compiled.                                                                                                     |
| `npm run check`                                                                                   | PASS: format, typecheck, lint, 88 Vitest tests, 10 helper safety tests and production build.                                                  |
| `$env:APP_ENV='local'; $env:LOCAL_IDENTITY_TESTS='1'; npm run test:local`                         | PASS: smoke, 12 identity, 16 Activity and 16 directory groups with real Auth/HTTP/PostgreSQL/RLS; synthetic fixture cleanup reported success. |
| `$env:APP_ENV='local'; $env:LOCAL_IDENTITY_TESTS='1'; npm run test:local -- directory`            | PASS after expanded inactive/unlinked/missing-roster/membership cases: smoke and 16 directory groups; cleanup reported success.               |
| `git diff --check`                                                                                | PASS; no whitespace errors.                                                                                                                   |

The local suite verified one Section A and one Both Activity, no duplicate assignments,
roster exclusion counts, scoped creator and counselor pages, inactive/unassigned denial,
reassignment/revocation, one persisted completion, concurrent duplicate rejection,
reported-versus-verified status, explicit verifier authority, invalid requests and
a forced database history failure with full transaction rollback. The preexisting
identity and Activity suites also passed in the combined run. SQL tests assert RLS,
anonymous denial and the named elevated-function/search-path contract.

One edit to fixture cleanup was rejected by automatic review because a department-wide
delete could affect unrelated local Activities; cleanup was narrowed to records created
by the synthetic users. Prettier then found a quoted string syntax error in the newly
added test fixture; it was fixed before the successful focused run. The forced history
failure deliberately logged PostgreSQL `P0001`, returned 503, and left no partial
Activity. No health checks were bypassed.

At 3B-2A this was a backend API without teacher/student dashboards, production roster,
hosted OAuth or deployment verification. Section selection is a publication-time
snapshot; later roster changes do not automatically add/remove existing assignments.
The 50-row monitor pages use numeric offsets capped at 10,000; large historical data
and concurrent writes may require cursor pagination later. Group targeting, automatic
recurrence, cancellation, notifications, follow-up and catch-up remain unimplemented.

## Milestone 3B-2B operational dashboards — 2026-10-27

The approved 3B-2A checkpoint is local commit `20d0d3c` (parent `497a97d`), containing
the 14 reviewed milestone files. It was confirmed as a clean worktree before 3B-2B.
This milestone is uncommitted on `codex/milestone-3b-2b`. No push, deployment, remote
database connection, reset or real roster import occurred.

Protected student, faculty and counselor dashboards now consume real session-backed
APIs. Students see only RLS-visible assignments, windows, deadline/status and own
history; reporting calls the existing completion RPC and reloads the saved Activity.
Faculty publish one section Activity and inspect their own results. The form loads
current approved category/section combinations and eligible roster counts from the
read-only `activity_creation_options` RPC added in forward migration
`20261027000700_activity_creation_options.sql`; publication rechecks all permissions
and targets in the existing `create_section_activity` RPC. A failed save retains the
form values. The own-created list and lightweight summary use RLS-filtered reads.
The result screen is read only and never implies CREATE grants VERIFY. Counselors
see only current trusted mappings and shared completion rows, including work from
other creators. The mapped-student endpoint now pages at 50 rows.

`@playwright/test` 1.64.1 is pinned as a development dependency. The test launches
the already installed Microsoft Edge in headless mode; it does not download a browser.
The real browser signs in as synthetic local Auth users, publishes to both sections,
checks one Activity despite a double click, reports one completion despite a double
click, reloads the student page, and compares creator/counselor results to the same
database records. It also checks a rejected save with retained values, mobile width,
keyboard checkbox interaction, anonymous redirect, another student's data isolation,
and a zero-eligible-roster form state. Existing profile self-service remains available.

| Executed command                                                                                  | Actual result                                                                                                                                            |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$env:SUPABASE_HOME=Join-Path (Get-Location) '.supabase-home'; npx supabase migration up --local` | PASS: applied only `00700` to the existing local DB without reset.                                                                                       |
| `$env:SUPABASE_HOME=Join-Path (Get-Location) '.supabase-home'; npm run test:rls`                  | PASS: 3 pgTAP files, 163 assertions, including the new function's authenticated grant, anonymous denial and fixed-path SECURITY DEFINER checks.          |
| `npm run check` (approved local process access)                                                   | PASS after final UI edit: format, typecheck, lint, 95 Vitest tests, 10 helper tests and production build.                                                |
| `npm run build` (approved local process access)                                                   | PASS after final UI edit; all dashboard and API routes compiled.                                                                                         |
| `$env:APP_ENV='local'; $env:LOCAL_IDENTITY_TESTS='1'; npm run test:local`                         | PASS: health-gated smoke, 12 identity, 16 Activity and 20 directory groups including the real Edge workflow; synthetic fixture cleanup reported success. |
| `$env:APP_ENV='local'; $env:LOCAL_IDENTITY_TESTS='1'; npm run test:local -- directory`            | PASS after adding the empty-roster browser assertion: smoke plus 20 directory groups; cleanup reported success.                                          |

The first focused run stopped at the existing smoke assertion for the old public copy;
the assertion was updated to require the new honest page and an anonymous dashboard
redirect. Early browser runs exposed ambiguous Playwright alert/status selectors, which
were narrowed, and a genuine form bug: refreshing authorized options unmounted the
form and erased input after a failed save. The form now stays mounted during refresh,
and the browser's retained-value test passes. Initial Edge launch inside the filesystem
sandbox failed; the same installed browser launched with approved local process access.
The local npm install similarly needed approved network access. Forced database-failure
tests still log expected `P0001`/`58000` codes and verify visible 503/rollback.

A final UI audit found that failed list reads could also display an inaccurate empty
state. Student, faculty and counselor views now show the read error without claiming
that the roster or assignments are empty. A sandboxed `npm run check` passed
formatting, types, lint and unit tests, but its build stage failed with Windows
`EPERM` creating a generated `.next` prerender directory. `npm run build` and a
complete `npm run check` then passed with approved local process access. A sandboxed
SQL run could not reach
the local PostgreSQL port; the existing containers were healthy, and the approved
local run passed all 163 assertions. The full local integration suite passed again
after the UI edit.

Limits: no actual 124-student roster or production staff accounts are present. Aggregate
eligible counts are a current estimate and may change before publication; the saved
assignment count comes from the committed transaction. The UI filters the currently
loaded 50-row page, not all historical pages. Offset pagination is capped at 10,000
in monitoring APIs. There is no reviewer Verify button or full reviewer dashboard;
verification remains the existing authorized API operation. Group targeting,
notifications, recurrence, catch-up, hosted OAuth and production load/concurrency
behavior remain outside this milestone. This local verification is not a production
readiness claim.

## Milestone 4 — first operational experience, 2026-10-27

The starting repository was clean `main` at `5cc03ac`, equal to `origin/main`.
Work is isolated on `codex/milestone-4` and remains uncommitted. No remote
Supabase connection, database reset, deployment, push, merge or actual roster
import occurred. Existing identity, Activity, completion and directory models
were retained.

Faculty can publish one Activity to authorized Section A/B audiences or select
named eligible students from a bounded search over active linked roster rows.
The selected path records the chosen sections, creates the usual Activity,
assignments and history, and rechecks CREATE authority at publication. The
optional counseling audience also requires a current trusted mapping for each
student; counseling alone does not grant CREATE. Student work remains external
to ARKST. The student dashboard reports status through the existing completion
RPC and reloads the saved record.

Creator results and counselor detail show actual names, roll identifiers,
states and full-set completion counts. A progress bar uses complete authorized
database totals. Copy Pending Students obtains the entire authorized pending
set from one scoped database query, including rows beyond the 50-row display
page. The browser test verified a 58-student pending list while only 50 result
rows loaded. Counselor summary and detail counts include only currently mapped
active students, even for Activities published by another teacher.

Announcements are separate informational records and recipient snapshots;
they never create an Activity assignment or change an existing Activity. A
current `general` category CREATE approval for each addressed section is the
explicit publication authority. Activity assignments and announcement
recipients insert durable per-user inbox rows and outbox rows in the same
PostgreSQL transaction. Unique recipient/source keys prevent duplicate event
records. The inbox has own-recipient RLS, read/unread persistence, authorized
source links, pagination and refresh on focus/visibility. `processed_at` is
unused: desktop push and offline delivery have **not** been implemented.

Forward-only local migrations were applied in order: `00800` selected targets,
candidate search, counselor detail and full pending-copy query; `00900`
announcements, notifications and transactional outbox; `01000` complete
counselor Activity summaries; `01100` per-row counselor status fields; `01200`
private inbox cleanup when a test/deprovisioned account is removed. Existing
migrations were not edited. `operations_security.test.sql` adds database RLS,
grant, SECURITY DEFINER/search-path, trigger and uniqueness assertions.

| Command                                                                                           | Actual result                                                                                                                       |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `$env:SUPABASE_HOME=Join-Path (Get-Location) '.supabase-home'; npx supabase migration up --local` | PASS: applied `00800`–`01200` to the existing local database without reset.                                                         |
| `$env:SUPABASE_HOME=Join-Path (Get-Location) '.supabase-home'; npm run test:rls`                  | PASS: 4 pgTAP files, 213 assertions.                                                                                                |
| `$env:APP_ENV='local'; $env:LOCAL_IDENTITY_TESTS='1'; npm run test:local -- operations`           | PASS: 9 real Auth/PostgreSQL/API/Edge groups and synthetic cleanup.                                                                 |
| `$env:APP_ENV='local'; $env:LOCAL_IDENTITY_TESTS='1'; npm run test:local -- directory`            | PASS: 20 prior directory groups and browser flow after scoping selectors to the Activity form.                                      |
| `npm run check` (approved local process access)                                                   | PASS: formatting, typecheck, ESLint, 100 Vitest tests, 10 helper safety tests and production build.                                 |
| `$env:APP_ENV='local'; $env:LOCAL_IDENTITY_TESTS='1'; npm run test:local`                         | PASS final rerun: health-gated smoke, 12 identity, 16 Activity, 20 directory and 9 Milestone 4 groups; synthetic cleanup succeeded. |

The Edge walkthrough used real synthetic Auth users. It selected six named
students, double-clicked publication and checked one saved Activity, viewed a
recipient inbox on a mobile viewport, reported completion and reloaded,
confirmed creator/counselor states and percentages, copied the counselor's
complete pending list through the browser clipboard, and published a no-tests
announcement. API/PostgreSQL checks confirmed exact recipients, no obligation
from the announcement, authorization denials, idempotent read/event handling,
and a forced outbox insert failure that returned 503 and rolled back both kinds
of publication. The old directory browser suite initially failed because its
page-wide Section A selector also matched the new announcement form; its
existing checks were scoped to the original Activity form and passed.
The first Milestone 4 browser run had a status locator matching both a filter
and status explanation; the locator was narrowed to the rendered status badge.
The first full `npm run check` stopped at Prettier because a Windows Git
checkout had converted otherwise unchanged files to CRLF. Prettier now accepts
either checkout line ending, and formatting-only changes to prior files were
restored. No prior test assertion was removed. Expected synthetic outbox
failure logs `P0001` while both publications roll back.
An intermediate combined run passed identity, Activity and directory checks,
then Edge closed unexpectedly during the new announcement browser step. The
focused Milestone 4 suite had passed that step. Windows showed about 1.10 GiB
free afterward, but the exact browser-closure cause was not established.
The browser test now closes finished contexts before opening the next one;
the final combined run passed without any Docker, WSL or memory-limit changes.

Limitations: no approved 124-student roster or production users are present.
Desktop push, offline workers, notification retries, recurrence, Activity
cancellation/editing, reviewer UI, dynamic groups and actual follow-up delivery
remain outside this milestone. Roster candidate and result pages are bounded
at 50; filters apply to the current page while summaries and copy use the full
authorized set. Published recipients are a snapshot; later roster/mapping
changes do not silently rewrite assignments or notifications. Local synthetic
verification does not establish production readiness.
