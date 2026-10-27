# Project status — through Milestone 3B-2A, 2026-10-27

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
`codex/milestone-3b-2a` branch. There is no commit or push. Forward-only migration
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

Limits: this is a backend API without teacher/student dashboards, production roster,
hosted OAuth or deployment verification. Section selection is a publication-time
snapshot; later roster changes do not automatically add/remove existing assignments.
The 50-row monitor pages use numeric offsets capped at 10,000; large historical data
and concurrent writes may require cursor pagination later. Group targeting, automatic
recurrence, cancellation, notifications, follow-up and catch-up remain unimplemented.
