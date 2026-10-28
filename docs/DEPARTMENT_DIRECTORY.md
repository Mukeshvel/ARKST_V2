# Department directory — Milestone 3B-1

This milestone adds a structured department roster, trusted counselor mappings and
faculty self-service. It does not create users from roster rows and does not import
actual departmental data. The database is ready for approved data; all integration
records used so far are synthetic.

## Data model

Migration `20261027000200_department_directory.sql` adds:

| Table                        | Use                                                                                                                                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `department_student_roster`  | External student identifier as text (not a sequence), display name, department, exact section and optional link to an already provisioned student Auth profile. Unique identifier per department; one roster row per linked student. |
| `counselor_student_mappings` | Effective-dated mapping to an existing responsibility whose role is counselor. No fixed counselor caseload or fixed four-year row duration. Reassignment history is retained by ending an old row and adding another.                |
| `staff_directory_profiles`   | Self-editable teaching status, descriptive designation, up to 20 subjects and update actor/time. Current teaching status is also synchronized to the existing `profiles.staff_classification` field.                                 |
| `staff_section_preferences`  | Self-editable set of approved direct sections, including both sections. These preferences are descriptive and do not grant permissions.                                                                                              |
| `department_directory_audit` | Before/after faculty profile changes; roster, mapping and staff provisioning actions with actor/time and relevant IDs.                                                                                                               |

Existing `scopes`, `profiles`, `responsibility_assignments`, `activity_capabilities`
and `student_scope_memberships` are reused. A roster link and a section membership are
created only for an already active, trusted-provisioned student account. A roster-only
student has no Auth user and no app login. External identifiers are never parsed as
integers. Google OAuth remains unconfigured; future Auth providers can link the same
trusted Auth UUID after verification.

Forward migrations `20261027000400_directory_security_correction.sql` and
`20261027000500_directory_active_staff_mapping.sql` add a database exclusion constraint
for one primary counselor interval per student, relationship guards and active-only
counselor monitoring. They preserve ended mapping rows and existing Activity records.
The migration aborts if existing directory relationships conflict with these rules.

## Staff self-service

`/profile` renders the editor for an authenticated active staff profile. The browser
loads `/api/staff-directory`; department sections are returned only when the user has a
current responsibility in that department. Save POSTs a bounded, same-origin JSON body
to the same endpoint. The route verifies the existing Auth session and uses the caller's
Supabase cookie client. `update_staff_directory_profile` derives the actor using
`auth.uid()`, accepts no user/role/capability field, checks every section, updates both
teaching-status locations, replaces subjects/preferences, and writes an audit event in
one PostgreSQL transaction. API success is returned only after a committed write and a
fresh database read.

The user may change teaching/non-teaching status, subjects, custom designation and
sections without an approval step for each ordinary preference edit. Custom labels such
as “Placement Coordinator”, “German Coordinator” or “HOD” remain plain description text.
They do not add a responsibility or Activity capability. Counselor mappings live in
their own table and are unaffected by the edit. Self-service access requires a current
department responsibility; section-only or unrelated staff accounts cannot change this
directory profile until a trusted operator provisions the appropriate department record.

Staff can see only their own directory row/preferences/audit. Students cannot read or
edit staff directory records. No profile lookup by arbitrary staff ID exists.

## Approved staff provisioning

Institutional email confirmation alone does not create an application profile or grant
department access. A department operator must separately verify the person and run the
local, database-owner provisioning command below. It requires an active staff operator
with a current `admin` responsibility in the exact department, a confirmed existing
Supabase Auth account without an application profile, a current ordinary responsibility
name, direct department sections and explicit Activity categories. It creates no Auth
account. HOD/Admin role creation is intentionally excluded from this routine path and
remains subject to the separately controlled existing process.

```powershell
$env:SUPABASE_HOME = Join-Path (Get-Location) '.supabase-home'
$env:LOCAL_DATABASE_URL = 'postgresql://<local-owner>:<local-password>@127.0.0.1:54322/postgres'
npm run test:directory-admin -- provision-staff --operator <approved-admin-uuid> --department <department-uuid> --user <existing-auth-uuid> --status non_teaching --role placement_coordinator --sections <section-a-uuid>,<section-b-uuid> --categories general,placement
```

The first invocation validates and prints a row preview only. Review it, then repeat the
same command with `--apply` to commit all profile, responsibility, capability,
preferences and audit rows in one transaction. Never put database credentials in app
environment variables or tracked files. The integration harness supplies the URL only
to this separate child process in local tests.

Activity creation capability is explicit and tied to the department responsibility and
approved categories. Creation covers only that department's direct section scopes. A
department create grant does not extend read or verify to those child sections; those
operations retain the original exact-scope rule. It gives no
HOD/Admin power, inherited scope access, student-profile lookup, counselor mapping or
roster browsing. A non-teaching placement staff member can receive approved Activity
capability without changing teaching classification. Merely editing their profile never
changes this capability.

## Administrator CSV workflows

Both import modes require an approved CSV, exact active department admin responsibility,
and loopback `LOCAL_DATABASE_URL`. Files are read-only and preview is the default. Every
row and foreign reference is validated before writes. `--apply` performs the full batch
in one transaction, with uniqueness constraints protecting concurrent/duplicate imports.
Errors abort; no partial successes are reported. The tool does not call Auth Admin or
create accounts. Keep the approved source file outside Git and restrict access to it.

Roster CSV headers must appear in this exact order:

```csv
student_identifier,display_name,section_scope_id,linked_student_id
STU-1042,"Student 1, Section A",<section-a-uuid>,<existing-active-student-profile-uuid>
90001,Student 2,<section-b-uuid>,
```

`student_identifier` is a nonempty external text key up to 80 characters; it may include
leading zeros or nonnumeric characters. A linked profile UUID is optional. When supplied,
it must identify an existing active student profile. No row can overwrite an existing
identifier. Linked rows also receive a current exact-section `student_scope_memberships`
row; unlinked roster-only rows do not create an app account or membership.

Counselor CSV headers:

```csv
student_identifier,counselor_responsibility_id,starts_at
STU-1042,<approved-counselor-responsibility-uuid>,2026-10-27T06:30:00.000Z
```

Every student identifier must already exist in this department roster. The responsibility
must be active, belong to active staff with the `counselor` responsibility, and scope
that department or the student's exact section. Start time is canonical UTC. A duplicate
mapping or overlapping counselor interval is rejected by the database. Caseload counts
have no hardcoded limit. This import command adds initial mappings only.

For a current change, use `reassign-counselors` with headers
`student_identifier,counselor_responsibility_id`, or `revoke-counselors` with header
`student_identifier`. Both preview by default. `--apply` locks each roster row in a
stable order, closes the current mapping at the transaction timestamp, inserts the
replacement if requested, and records an audit event. The exclusion constraint also
protects concurrent direct writes. Future scheduled mappings are rejected for review
by these commands. Historical rows remain stored; ordinary counselor RLS exposes only
current mappings for active roster students and active staff. Historical access requires
a separate explicitly authorized operator process; there is no application endpoint.

Preview and commit examples:

```powershell
npm run test:directory-admin -- import-roster --operator <approved-admin-uuid> --department <department-uuid> --file C:\approved\roster.csv
npm run test:directory-admin -- import-roster --operator <approved-admin-uuid> --department <department-uuid> --file C:\approved\roster.csv --apply
npm run test:directory-admin -- import-counselors --operator <approved-admin-uuid> --department <department-uuid> --file C:\approved\counselors.csv
npm run test:directory-admin -- import-counselors --operator <approved-admin-uuid> --department <department-uuid> --file C:\approved\counselors.csv --apply
npm run test:directory-admin -- reassign-counselors --operator <approved-admin-uuid> --department <department-uuid> --file C:\approved\reassignments.csv --apply
npm run test:directory-admin -- revoke-counselors --operator <approved-admin-uuid> --department <department-uuid> --file C:\approved\revocations.csv --apply
```

This CLI requires an owner connection and checks the operator UUID and exact
department admin responsibility before reading/importing. Local use requires a
loopback `LOCAL_DATABASE_URL`. Session 3 adds an explicit hosted operator mode with
`APP_ENV=hosted`, `ARKST_HOSTED_ADMIN_ENABLED=true`, `ADMIN_DATABASE_URL` and an exact
`--database-host` argument, with TLS certificate checks; hosted use is unverified.
The app has no roster,
counselor-mapping, staff-provisioning, HOD or admin management endpoint. Owner/service-role
access can bypass RLS, so production administrative tooling, key custody, change approval,
backup/rollback and durable operator audit review still need a separate security review.

## Counselor visibility

`GET /api/counselor/students` and the underlying RLS expose only roster records linked to
current mappings for the caller's current counselor responsibility, while both the
roster row and staff profile are active. A profile edit,
designation, email domain, section preference or second unrelated responsibility cannot
create counselor access. Roster reads exclude institutional email and creator data at the
column-grant layer. A counselor does not gain student Auth profiles, unrelated students
or any Activity capability from this mapping alone.

Milestone 3B-2A also exposes `GET /api/counselor/activities?offset=0`. A fixed-path
database RPC joins only current approved mappings, current counselor responsibilities,
active roster rows and active linked student profiles to existing Activity assignments
and completion rows. Each response page contains at most 50 assigned Activity/status
rows and omits student email. It includes work published by other authorized staff,
without making counselor access an Activity CREATE, general READ or VERIFY grant.
Reassignment and revocation remove the old counselor's ordinary current view; historical
mapping, Activity and completion records remain stored.

Milestone 3B-2B pages `GET /api/counselor/students?offset=0` at 50 rows and returns
an RLS-filtered total. The counselor dashboard displays that trusted current mapping
list alongside the paginated shared Activity status view. Staff profile fields and
navigation links do not change either authorization rule.

## Verification and limits

Real local integration tests preview/apply roster and counselor CSVs, validate rollback
and duplicates, use nonconsecutive identifiers and variable counselor counts, authenticate
through Supabase and the real app, persist profile changes, reload them, preserve mappings,
and test student/staff boundary denial. A temporary local database trigger forces an audit
write failure; the API returns 503 and the test confirms both profile and section changes
roll back. SQL pgTAP separately checks RLS, grants and RPC constraints. See
`PROJECT_STATUS.md` for exact final counts and commands.

No department data has been imported. Tests do not use actual student or faculty data.
Production Google sign-in, complete 124-student roster import, ongoing academic records,
full directory UI beyond the self-service form, HOD/Admin workflows and counselor follow-up
workflow remain unverified or out of scope.

## Session 3 approved email and operator operations

`20261028002300_roster_email_identity.sql` adds a case-insensitive unique approved
email across the roster. `import-roster` now optionally accepts a fifth
`institutional_email` column; existing four-column files remain valid. A confirmed
existing Auth user can be linked with `provision-student --operator ADMIN_UUID
--department DEPARTMENT_UUID --student IDENTIFIER --user AUTH_UUID --email EMAIL`.
The roster email must exactly match that Auth email, and preview is read-only until
`--apply`. `update-roster` accepts
`student_identifier,new_student_identifier,display_name,institutional_email`; it
validates identifiers and linked-user email consistency, updates the linked profile
name, and audits changes in one transaction. It cannot change the section or
counselor mapping. Use the existing reassignment commands for counseling.

`scripts/admin-operations.mjs` adds preview/apply commands for ordinary staff
responsibilities, per-category CREATE/VERIFY, escalation routes and safe ending of
responsibilities. It rejects self-assignment of HOD/admin and blocks removal while
active routes, mappings or open cases need attention. Changes are recorded in the
private `trusted_operator_history` table. This is a restricted operator tool, not a
self-service profile page or public admin API. See
[RELEASE_OPERATIONS.md](RELEASE_OPERATIONS.md) for invocation boundaries.

# Session 2 operation grants

The trusted local `directory-admin.mjs grant-operations` command adds an independent
exact-department group, calendar or supervisory grant to an already approved current
staff responsibility. It previews by default, requires a current exact-department
admin operator, rechecks both responsibilities under lock at apply time, and writes
old/new flags with actor/time to `department_operation_grant_history`. Supplying
`false` for all three flags revokes the capability row. The command accepts only the
loopback local database URL and does not provision an Auth account. Faculty profile
edits, custom designation and preferred sections cannot change these grants or
counselor mappings. See [WORKFLOWS.md](WORKFLOWS.md) for the complete command.
