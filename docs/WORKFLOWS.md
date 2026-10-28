# Follow-up, attention, escalation and catch-up — Session 1

Session 3 operational summary: the existing pages and RPCs remain the source of
truth. Trusted roster linking/correction and staff grant/route changes now have
preview/apply CLI paths; Google OAuth is disabled by default and requires external
provider setup; hosted push/calendar runners are opt-in and have not been activated.
See [RELEASE_OPERATIONS.md](RELEASE_OPERATIONS.md) for the setup and verification
boundary. No actual student/staff records have been imported.

## End-to-end workflow inventory (Session 3 review)

| Workflow                                                      | Code/data path                                                                     | Local evidence and remaining boundary                                                                                                                                      |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Provision identities, roster, roles, counselors, groups    | Trusted preview/apply CLI plus groups UI, Auth profile/scopes and audited mappings | Directory and Session 2 suites pass; initial HOD/admin bootstrap and real approved data remain external.                                                                   |
| B. Faculty targets selected/counseling/group/section students | Shared Activity publication RPC/API with exact grants and snapshot assignments     | Activity, directory, operations and Session 2 suites pass; no real staff acceptance yet.                                                                                   |
| C. Student receives/reports work                              | Inbox/outbox plus own Activity API and one completion row                          | Activity, push and workflow suites pass; actual external academic work is outside ARKST.                                                                                   |
| D. Creator monitors authorized results                        | Faculty Activity summaries, detail, pending list                                   | Operations and Edge checks pass.                                                                                                                                           |
| E. Counselor monitors mapped students                         | Current trusted mapping, paginated names/identifiers/charts/pending list           | Directory/operations/Edge checks pass; inactive/reassigned students lose ordinary current access.                                                                          |
| F–G. Follow-up and resolution                                 | Durable follow-up/history/inbox; report resolves open case                         | Session 1 real Auth/API/PostgreSQL checks pass.                                                                                                                            |
| H. Escalation                                                 | Trusted counselor/section coordinator/branch/HOD routes and case history           | Session 1 checks pass; actual route contacts and policy pending.                                                                                                           |
| I. Catch-up                                                   | Student request, authorized review, separate official publication                  | Session 1 checks and Edge rendering pass; real institutional content pending.                                                                                              |
| J. Informational announcement                                 | Shared target snapshots, inbox only                                                | Operations/group/Session 1 tests pass; creates no completion obligation.                                                                                                   |
| K. Dynamic groups                                             | Authorized UI/API, membership history, publication snapshot                        | Session 2 API/database/Edge checks pass.                                                                                                                                   |
| L. Recurring tests/blackouts                                  | Configurable slots, scheduler RPC, idempotent instances, conflict review           | Session 2 checks pass; hosted scheduler is prepared but inactive.                                                                                                          |
| M. Supervisory progress                                       | Separate department grant, aggregate/detail from shared records                    | Session 2 RLS/API/Edge checks pass.                                                                                                                                        |
| N. In-app and desktop notifications                           | Recipient inbox/outbox, per-user subscription, trusted dispatcher, service worker  | Local inbox/dispatcher checks pass; normal Chrome Windows popup/click observed in Milestone 5.1. Hosted delivery and tab-closed/account-switch behavior remain unverified. |

This inventory reflects code and separate test evidence, not one combined acceptance
scenario with institutional data. Neither a hosted Google login nor background job
operation has been claimed as tested.

This session extends the existing Activity, directory and inbox/outbox models. It does
not perform academic work in ARKST: students complete NPTEL, tests and assignments
externally, then report status against the existing Activity assignment. No production
roster, route, counselor mapping or account is seeded.

## Follow-up

`activity_follow_ups` references one existing `activity_assignments` row. The stored
recipient, initiator, reason, time, status and resolution retain their history in
`activity_follow_up_history`. A student report resolves an open follow-up in the same
completion transaction. Staff may close a follow-up with a note; that never changes
the Activity completion state. One open follow-up per assignment and a 24-hour
per-assignment cooldown prevent immediate repeat notices. A request can contain 1–100
distinct assignments; all are locked, authorized and inserted atomically. Each
recipient gets one inbox notice and outbox job through the existing trigger.

The current trusted counselor mapping grants follow-up for an active mapped student.
The creator may follow up on their own Activity only while current category CREATE
authority covers the student's current section and the creator's original target
selection. Direct Activities additionally retain their existing exact-scope READ
requirement. Neither permission grants verification or general private roster reads.
Faculty and counselor Activity result pages show eligible pending students, their
names/identifiers, deadlines, recorded follow-ups, status and history.

## Attention needed

`GET /api/attention` lists only current pending assignments visible through the same
follow-up scope. It explains each row with recorded conditions: an overdue deadline,
a deadline within 48 hours, at least two outstanding assigned Activities, an open
follow-up, or a submitted/approved missed-information request the staff member may
see. A separate scoped list shows missed-information requests even when that student
has no pending Activity; it distinguishes staff who may review from counselors who
may only monitor. The page shows the reason text and student name/identifier, plus
the Activity title and deadline where relevant. There is no score, inference model, hardcoded student or background
reclassification job. Refresh reads current PostgreSQL state. Inactive roster entries
and expired counselor mappings leave ordinary current monitoring.

## Escalation

`activity_escalations` and `activity_escalation_history` record initiator, recipient,
responsibility, assignment, stage, reason, time, status and resolution. A student may
send their own pending assignment to their current mapped counselor. That counselor
may advance it to the configured coordinator. The current recipient coordinator may
advance it to a configured branch coordinator, or to HOD if no branch coordinator route
is active. A current recipient may resolve with a required note. Reporting completion
resolves the open case without deleting its prior stages. One open case per assignment
and a 24-hour per-stage cooldown bound repeat notifications. Every stage creates a
recipient inbox/outbox event. A route with no active matching responsibility rejects
advancement and leaves the current stage intact.

Routes are trusted database configuration, not designation text or an app role picker.
After institutional approval, a database operator can insert a row into
`escalation_routes` for each section/target role. For example, using parameterized
values for an already approved section and responsibility:

```sql
insert into public.escalation_routes
  (section_scope_id, target_role, responsibility_id)
values ($1, 'coordinator', $2);
```

The database validates that the responsibility has the target role and belongs to the
same section or its department. Only a trusted service/database role can write routes;
no user-selected profile field changes them. At most one active route exists per
section and role. Effective-dated responsibility and current mapping/route are checked
again when an escalation is opened, viewed, advanced or resolved. Route or counselor
changes remove ordinary current case access from the old recipient. A trusted operator
must inspect open cases when changing routes, because the system does not silently
transfer an open case to a new recipient.

## Catch-up

A student with an active linked roster entry submits a subject and missed-information
description. `catch_up_requests` and `catch_up_history` retain actor/time transitions.
An active staff member with explicit `general` CREATE approval for the student's
current section may approve or reject; rejection requires a reason. A trusted current
counselor can see the student's request but cannot review or publish from the mapping
alone. Approval never publishes the student's unverified text. Authorized staff must
write the official title/message and choose either the requester or the section
recorded with the request. The publication RPC calls the existing announcement
workflow in one transaction; its recipient rows create the existing inbox/outbox
notices. The announcement is readable by its selected recipients. A duplicate pending
subject is rejected, and an approved request can be published only once.

Students can recover assigned Activity descriptions/deadlines through **My activities**
and official announcements/teacher instructions through **Inbox**, including older
items within those existing paginated views. A catch-up request does not reopen an
expired Activity deadline or create a completion record. Authorized staff must
publish a new Activity if a new obligation/window is approved.

## API and security boundary

New authenticated routes are `/api/follow-ups`,
`/api/follow-ups/{id}/resolve`, `/api/attention`, `/api/attention/missed`, `/api/escalations`,
`/api/escalations/{id}/resolve`, `/api/catch-up`,
`/api/catch-up/{id}/review` and `/api/catch-up/{id}/publish`. Mutations use the existing
verified session, same-origin JSON request and 64 KiB body limit. PostgreSQL
SECURITY DEFINER RPCs derive `auth.uid()`, validate scope and lock state transitions.
Direct authenticated table writes are revoked and read RLS is scoped. Three private
boolean helpers are executable by the authenticated role because PostgreSQL evaluates
their RLS predicates as that role; the private schema is not a REST-exposed schema.
Sensitive functions retain fixed empty search paths and regression assertions.

Workflow inbox notices carry a constrained same-origin destination. The existing push
worker still rechecks the signed-in recipient before showing a generic preview, and
only Activity, announcement, inbox or attention paths are accepted on click. New
workflow integration tests verify persisted outbox records, not actual provider or
Windows popup delivery. The prior Milestone 5.1 manual Windows delivery/click evidence
is recorded separately in `PROJECT_STATUS.md`.

## Verification and remaining work

Run `npm run check`, `npm run test:rls`, then with the existing local stack and fresh
production build:

```powershell
$env:APP_ENV='local'; $env:LOCAL_IDENTITY_TESTS='1'; npm run test:local
```

The workflow suite creates only disposable synthetic local Auth users, scopes,
responsibilities, routes, roster entries and Activities, and removes them after each
run. It covers the end-to-end NPTEL follow-up, report resolution, catch-up approval
and publication, rejected requests, three-stage escalation, current-mapping access,
55-recipient batching and outbox-failure rollback. The same command regresses all
earlier suites. See `PROJECT_STATUS.md` for the exact observed results.

Trusted route configuration has no browser admin editor. Hosted push still needs a
trusted scheduler and approved secrets. No actual departmental data, hosted Auth,
Google OAuth, dynamic groups or recurring academic schedule is configured here.
Session 2 can add recurrence and dynamic groups after this Session 1 state is reviewed;
it should not replace the Activity, identity or notification models.

## Session 2 current operations

The earlier sections record the Session 1 state. Session 2 adds the following
operations to the same identity, Activity, assignment, completion, follow-up and
notification models.

### Trusted grants

The exact-department `department_operation_capabilities` row belongs to a current
staff `responsibility_assignments` row. `can_manage_groups`, `can_manage_calendar`
and `can_supervise` are independent of each other and of Activity category CREATE,
READ and VERIFY. Role names, staff teaching preferences and designation text grant
none of them. Only a trusted administrator with a current exact-department admin
responsibility and local database-owner access can run the preview/transactional
operator command:

```powershell
# LOCAL_DATABASE_URL must be the existing loopback Supabase DB URL; do not paste it in chat.
node scripts/directory-admin.mjs grant-operations --operator <admin-user-uuid> --department <department-scope-uuid> --responsibility <staff-responsibility-uuid> --groups true --calendar false --supervise false
# Review PREVIEW. Repeat with --apply to save and audit; use all false to revoke.
```

The script checks both current responsibilities again under transaction locks before
writing. `department_operation_grant_history` records old/new flags, actor and time.
No staff profile edit can invoke this path or directly edit the table.

### Groups and publication

`/dashboard/groups` lists groups only to a staff account with the exact department
group grant. Name and purpose are free text (for example RHP, NPTEL or placement),
so new groups require no code change. The manager can edit/disable a group, search
eligible active linked roster students, add/remove members, see current members
including later-inactive members, and page membership history. Adding checks the
student's active roster/profile and direct section membership. Duplicate membership
is rejected; removal records an effective end and actor/time history. Disabling a
group blocks additions and publication while still permitting authorized removal
of existing members.

Group Activity and announcement publication locks the group, checks **every** current
member against the existing category CREATE authorization, and invokes the existing
selected-student Activity or announcement publisher in one transaction. An empty,
oversized (over 500), inactive or cross-scope audience cannot silently publish.
The saved `activity_assignments`/`announcement_recipients` and target-section rows
are the immutable publication snapshot; `activity_target_groups` and
`announcement_target_groups` retain group provenance. Member edits never add or
remove recipients from earlier publications. Completion, verification, monitoring,
follow-up and outbox notices use the established rows. An inactive current group
member must be explicitly removed before a new publication; their earlier assigned
work remains historical.

### Weekly external-test calendar

`/dashboard/calendar` requires the independent calendar grant. A schedule starts
**paused**. The manager chooses an anchor Monday, IANA timezone (initially
`Asia/Kolkata`), 1–4 week cycle and 1–20 department sections. Slots hold editable
position, cycle week, start/end weekday and **local** 24-hour times, title,
description, verification requirement and active status. The initial suggested
two-week rows are Test 1 Mon–Wed, Test 2 Thu–Sat, Test 3 Mon–Tue, Test 4 Wed–Thu,
Test 5 Fri–Sat. Staff must enter actual approved hours; these are availability
windows for external tests, not online exams. Overlap within a cycle is rejected.
Slot and section edits affect only future generation, never an already-published
Activity. The generated Activity deadline equals the end of its availability window.

An active department blackout records exact UTC start/end instants and blocks any
new occurrence whose window overlaps it. The runner records a `blocked` occurrence
with no Activity, assignment or notification. Deactivating a blackout does not
silently generate it: an authorized manager must explicitly requeue, then rerun,
or keep it skipped. A blackout created after publication shows a visible conflict;
the already-published Activity is not deleted or changed. The unique
`(schedule_id,slot_id,cycle_monday)` key and schedule row lock make repeated and
concurrent runs idempotent. Generation begins at the anchor Monday and uses the
existing `create_section_activity('weekly_test',...)` function, which rechecks the
runner's current CREATE authority for each selected section. Instance history and
conflicts are visible in the calendar UI.

The **Generate due instances** button runs the next 14 days synchronously. The
same real operation can be invoked from the trusted local CLI. Put the approved
staff email/password in Git-ignored `.env.scheduler.local` as
`ARKST_SCHEDULER_EMAIL` and `ARKST_SCHEDULER_PASSWORD` (or inject both as
process environment variables), then run:

```powershell
$env:APP_ENV='local'; npm run calendar:run:local
```

The CLI confirms the Supabase API is loopback, signs in through real Auth, enumerates
only that account's calendar grants, and reports published/blocked/existing counts.
It clears only its own in-process session; it does not revoke an operator's other
browser sessions. A dedicated, restricted scheduler identity is recommended.
It was exercised with a synthetic authorized staff login. **No background job is
running.** Automatic operation requires an approved always-on host, secure staff
credential storage and rotation, a scheduled invocation interval, logs/alerting and
network access to the target Supabase Auth/API. Production hosting must implement
and test that process explicitly. The existing Web Push dispatcher is separate and
also needs a trusted host schedule.

Manual NPTEL and other Activities keep their configured dates. The original creator
with current category CREATE scope can change deadline/end time from their Activity
result page; PostgreSQL validates the window and writes old/new times, actor and time
to `activity_window_changes`. No existing assignment is silently replaced.

### Supervision

`/dashboard/supervision` requires a separate exact-department `can_supervise`
grant. It reports active roster students' existing assignments, submitted reports,
awaiting-verification, verified, pending/overdue, open follow-ups and escalations.
Section and current counselor aggregates use the same records, and student detail is
paged at 50 rows. The student's **View work** control opens paged Activity,
completion and open case detail under that exact-department grant. A department
CREATE or group/calendar grant alone cannot read this private overview. Inactive
students and expired counselor mappings are excluded from ordinary current
supervision; historical rows remain stored. Activities originally targeted in a
different department are excluded even if the student later transfers into this
roster. Completion bars include submitted work awaiting verification; the numeric
states remain distinct.
