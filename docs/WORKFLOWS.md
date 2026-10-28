# Follow-up, attention, escalation and catch-up — Session 1

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
