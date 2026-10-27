# Activity engine — Milestone 3A

The shared PostgreSQL model supports assignment, weekly_test, nptel, seminar,
mini_project, placement and general. A trusted operator can add category rows without
new workflow tables or code branches; each category still needs explicit staff approval.
No real students, staff or capabilities are seeded by the migration.

## Authorization and provisioning

Existing profile, responsibility and scope rules remain intact. Role names and staff
classification grant nothing automatically. Before using the Activity API, a trusted
operator must provision the following approved records out of band:

1. An active student profile and a current student_scope_memberships row linking the
   student to the exact approved department or section.
2. An active staff profile and a current responsibility_assignments row in that scope.
3. An activity_capabilities row for that responsibility and category, explicitly setting
   can_create and/or can_verify. Verification is a separate capability.

Example parameterized SQL for a trusted operator, after organizational approval:

```sql
insert into public.student_scope_memberships (student_id, scope_id, starts_at)
values ($1, $2, now());

insert into public.activity_capabilities
  (responsibility_id, category_key, can_create, can_verify)
values ($3, $4, $5, $6);
```

Parameters represent already verified records and approved capabilities, not client
form values. There is no app endpoint for these inserts and no new college role policy.
Membership and capability tables cannot be read or changed by ordinary clients.
Responsibility/category pairing prevents mixing one role with another scope. Scope
parents are never traversed. Institution/group scopes are not valid creation scopes.

Both create and verify capability imply read access to the exact scope/category's
Activity data, including assignment UUIDs and their completion/history, but do not open
student profiles or an unassigned student directory. Creator ownership alone grants
no persistent access after capability/responsibility revocation. Existing student
assignments remain visible after membership expiry; inactive profiles lose all access.

## API contract

All endpoints require the existing real session and active provisioned identity.
Responses are private/no-store. Every POST requires application/json and an exact
configured Origin; cross-site requests are rejected. Maximum JSON size is 64 KiB.
Unknown create fields, caller-supplied actor/state, group targeting and invalid UUIDs
are rejected. There is no arbitrary-user query parameter.

| Method and path                            | Behavior                                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| GET /api/activities?offset=0               | Visible activities, nested visible assignments/completions; 50 activities per page. Stable created_at/id ordering. |
| POST /api/activities                       | Atomic creation and direct assignment; returns 201 with persisted id.                                              |
| GET /api/activities/{id}                   | One visible activity; hidden/nonexistent returns the same 404.                                                     |
| GET /api/activities/{id}/history?offset=0  | Visible history, ordered by id, 50 events per page. Students see only their own assignment events.                 |
| POST /api/activity-assignments/{id}/submit | Empty JSON object only; pending → reported by the assigned student.                                                |
| POST /api/activity-assignments/{id}/verify | Empty JSON object only; reported → verified by an approved reviewer.                                               |

Create payload (UUIDs below are illustrative placeholders, not provisioned accounts):

```json
{
  "category": "weekly_test",
  "scopeId": "10000000-0000-4000-8000-000000000001",
  "title": "Configured weekly test",
  "description": "Instructions for this concrete activity",
  "startsAt": "2026-11-02T03:30:00Z",
  "deadlineAt": "2026-11-02T04:30:00Z",
  "endsAt": "2026-11-02T04:30:00Z",
  "requiresVerification": true,
  "studentIds": ["20000000-0000-4000-8000-000000000001"]
}
```

Title is 1–160 trimmed characters; description is required (empty allowed), maximum
5,000 characters. There must be 1–500 distinct students. The entire publication is
rejected if any target is inactive or lacks current exact-scope membership. Categories
must exist and be explicitly authorized. All dates are finite UTC instants, with
start < deadline <= end and deadline in the future at creation. API strings require
ISO UTC Z notation, with optional three-digit milliseconds; impossible calendar dates fail.

Submission is allowed for start <= database transaction time < deadline (and < end).
An end after the deadline does not grant late submission. Verification can occur after
the deadline. There is no hardcoded weekly schedule, recurrence count or auto-generation.

## State and consistency

No completion row means pending. A student submission creates one reported row with
the authenticated actor and database timestamp. The existing src/core/activity.ts
accounting rule applies: reported counts as complete only when verification is not
required. A verification-required report remains awaiting review until an approved
staff member changes it to verified. verified_by must differ from submitted_by.

Submission/review lock the assignment row. A primary key prevents multiple completions;
concurrent submissions produce one 200 and one 409. Duplicate review and attempts to
verify pending work return 409. Verification of work that does not require it returns 400. There is no transition back to pending or reported, and no client-editable state.

Create, assignment, report and verification events record authenticated actor and server
time in the same transaction as the operation. A history write failure rolls back the
business write. Ordinary clients cannot insert/update/delete these tables directly.
Only narrowly granted RPCs write, with explicit authorization, an empty search path,
qualified relations and no caller-supplied actor. RLS filters all table reads, including
direct REST requests and embedded assignment/completion reads.

Expected errors: 400 invalid input/window, 401 missing/invalid session, 403 inactive or
unauthorized caller/target/Origin, 404 invisible activity, 409 duplicate/invalid transition,
413 oversized request, 415 unsupported content type and 503 upstream/database failure.
The API does not return raw SQL, tokens or hidden target details. A network failure after
commit can leave an uncertain result; reload before retrying. Create-request idempotency
keys are not implemented. Completion uniqueness still prevents duplicate reports.

## Real verification

```powershell
$env:SUPABASE_HOME = Join-Path (Get-Location) '.supabase-home'
npx supabase migration up --local
npm run test:rls
npm run check
$env:APP_ENV = 'local'
$env:LOCAL_IDENTITY_TESTS = '1'
npm run test:local
```

The local runner obtains credentials from the existing local CLI status in memory,
validates loopback endpoints, starts an ephemeral production app without admin keys,
requires a real 401 readiness response, then runs smoke, identity and Activity suites.
It stops the app in finally. It does not start/reset/link a database. Use
`npm run test:local -- activity` to isolate the Activity suite after a targeted change;
the default includes all identity regressions. Manual harness configuration remains
available through test:identity and test:activities; see IDENTITY_TESTS.md.

Activity integration creates seven actual Auth identities, real scoped records, and
signs in through Supabase plus the existing application login route. Sixteen groups
exercise authorization, cross-scope and per-student isolation, direct REST/RPC access,
concurrent duplicate submission, reload persistence, review, dates/body/CSRF validation,
revocation, category extension and pagination. Temporary database triggers/policies raise
real SQL exceptions to verify 503 responses and rollback. Finally removes fixtures and
failure hooks; cleanup errors fail the run and print object IDs for recovery. Forced
termination may leave fixtures; inspect the reported IDs before resetting a disposable
stack. Never point the harness at a tunnel or remote database.

The SQL suite independently checks grants, RLS, definer configuration, database constraints,
state transitions and exact clock boundaries. A 130-student transaction verifies bulk
assignment and per-student isolation. SQL role contexts are not Auth tests; the genuine
Auth suite is required separately. See PROJECT_STATUS.md for observed results.

## Limits and next decisions

No group/dynamic targeting, counselor oversight workflow, dashboards, notifications,
follow-up, catch-up, recurrence generation, editing/cancellation, evidence uploads or
rejection/resubmission exists. Direct assignments and history provide stable references
for future work. No profile roster endpoint or administrative/delegation tool exists.

The database owner/service role can bypass RLS and change history. Operator grants and
membership changes lack an administrative audit workflow. History is append-only for
application users, not an independently tamper-proof ledger. Authorization uses a
transaction snapshot; concurrent operator revocation does not cancel an in-flight
authorized transaction. This milestone does not test full 130-student/50-staff concurrent
load, browser behavior, refresh rotation, hosted OAuth or production infrastructure.
Copied access JWTs can remain valid until expiry after logout (existing identity limit).

Before another milestone, review/approve the real role-to-capability matrix and exact
student membership source, deadline/late-work policy, reviewer process and retention.
No standing college permissions are invented here. Stop at 3A; 3B/deployment/commit/push
require a separate instruction.
