# How Activities and completion work

One shared Activity model handles NPTEL, assignments, weekly tests, placement and
general work. A category labels a task; it does not create a separate tracking
database. The initial categories are inserted by [the Activity migration](../../supabase/migrations/20261027000100_activity_engine.sql).

## Publication

An approved faculty member uses [the faculty screen](../../src/app/dashboard/faculty/faculty-dashboard.tsx)
to choose a category, title, description, start, deadline, end, verification rule
and audience. The [section API](../../src/app/api/activities/sections/route.ts)
is for Section A/B publication; the [selected API](../../src/app/api/activities/selected/route.ts)
is for exact student IDs; a counselor selection is constrained by current trusted
mappings; a [group API](../../src/app/api/groups/[id]/activities/route.ts)
snapshots current eligible members. SQL checks every target and the current category
CREATE grant. Duplicate students receive one assignment for that Activity.

An Activity can start later, have a deadline and close later. The dates are stored
as absolute instants, not just display text. The student works externally and then
reports against their own assignment while the SQL window permits it. The teacher
can adjust a manual deadline only under the original creator/current CREATE rule;
the change is audited. Already-published assignments remain the same.

## Completion versus verification

[The student screen](../../src/app/dashboard/student/student-dashboard.tsx) reads
their RLS-filtered assignments. Its submission uses
[the assignment route](../../src/app/api/activity-assignments/[id]/submit/route.ts)
and the `submit_activity` SQL function. The unique `activity_completions.assignment_id`
key prevents duplicate completion rows. If verification is required, the state is
`reported`; an authorized staff reviewer uses
[the verification route](../../src/app/api/activity-assignments/[id]/verify/route.ts)
to change it to `verified`. The student cannot verify their own report. Each
important transition has actor/time history.

Imagine six students receive an NPTEL task. One reports completion. The creator
view shows one report and five pending; the linked counselor sees only the students
currently allocated to that counselor. [Creator monitoring](../../src/app/dashboard/faculty/activities/[id]/creator-results.tsx),
[counselor monitoring](../../src/app/dashboard/counselor/activities/[id]/counselor-results.tsx)
and [supervision](../../src/app/dashboard/supervision/supervision-board.tsx) read the
same assignments and completion records through different permission rules.

## One important reporting limit

The department supervision page has section and current-counselor aggregates over
the granted department's Activities. Its API takes department/section filters,
not an Activity ID. It therefore does **not** currently provide counselor-wise
counts for one chosen NPTEL Activity. A creator and each counselor can inspect that
Activity under their own narrower views. Do not interpret the all-Activity HOD
ratio as the NPTEL-specific ratio.

## Tests and safe edits

Read [input validation](../../src/core/activity-input.ts), [data calls](../../src/data/activities.ts),
[authorization wrapper](../../src/auth/activity-http.ts) and the relevant migration.
Run `npm run check`, `npm run test:rls`, and `npm run test:local -- activity`;
section, selected-student and monitoring behavior also has directory/operations
integration coverage. Keep category CREATE separate from READ, VERIFY, counselor
mapping and supervision grants.
