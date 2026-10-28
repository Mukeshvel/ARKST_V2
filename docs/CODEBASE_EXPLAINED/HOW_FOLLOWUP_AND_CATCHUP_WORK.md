# How follow-up, escalation and catch-up work

These workflows reuse Activity assignments, trusted counselor mappings and the
same notification inbox/outbox. They do not create a parallel student-tracking
database. The implementation and exact local evidence are also recorded in
[WORKFLOWS.md](../WORKFLOWS.md).

## Follow-up for pending work

A counselor opens an authorized Activity result or
[attention screen](../../src/app/dashboard/attention/attention-board.tsx), sees
pending mapped students and sends a reasoned follow-up through
[the API](../../src/app/api/follow-ups/route.ts). The
[follow-up migration](../../supabase/migrations/20261028000500_follow_up.sql)
checks current authority and assignment state, stores the recipient, actor, time
and history, and creates one notification for that student. The recipient can see
the notice. When the student reports completion, the open follow-up resolves in
the same completion transaction; its historical record remains. Duplicate/open
and cooldown rules prevent immediate repeated contact.

A creator with current category/scope authority can also follow up on their own
Activity under the SQL rules. That does not grant general private roster access.
If a counselor is reassigned, old current monitoring access stops; history is not
silently transferred or erased.

## Escalation is a separate route

An unresolved assignment can move from student to current trusted counselor,
then configured coordinator, then branch coordinator or HOD as the effective
route allows. [The escalation API](../../src/app/api/escalations/route.ts) calls
the [trusted SQL workflow](../../supabase/migrations/20261028000700_attention_escalation.sql).
The current recipient, stage, reason, resolution and history are stored. A
self-edited designation such as “Placement Coordinator” cannot become the route.
An administrator must configure approved responsibility and section-route records
through the restricted operator workflow.

## Catch-up is official information, not a completion shortcut

A student who missed class information submits a subject and explanation through
[the catch-up screen](../../src/app/dashboard/catch-up/catch-up-board.tsx) and
[API](../../src/app/api/catch-up/route.ts). An authorized staff reviewer approves
or rejects the request. Approval alone does not publish the student's text.
Staff write an official title/message and choose the permitted audience; the
[publication SQL](../../supabase/migrations/20261028000600_catch_up.sql) creates an
announcement and recipient notifications. It does not reopen an expired Activity
or change a completion state. If new work is required, an authorized teacher must
publish a new Activity or adjust a permitted deadline under its own rules.

## How to verify changes

Read [the API wrapper](../../src/auth/activity-http.ts),
[current counselor mapping rules](../../supabase/migrations/20261027000200_department_directory.sql)
and the three workflow migrations. Run `npm run check`, `npm run test:rls`, and
`npm run test:local -- workflows` with the isolated local stack. The workflow suite
uses synthetic real Auth users and database rows; it is not a test of actual
institutional route assignments or a hosted push service.
