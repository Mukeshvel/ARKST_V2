# How PostgreSQL and RLS work

PostgreSQL is ARKST's source of truth. React state is a current view; an Activity,
assignment or counselor mapping becomes real only after a database transaction.

## The central records

| Record                                                                           | Meaning in a college example                                                                               |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `profiles`                                                                       | The approved ARKST identity for a Supabase Auth UUID; inactive profiles cannot use private functions.      |
| `scopes`, `responsibility_assignments`, `activity_capabilities`                  | Which department/section a staff responsibility covers and which category operation is approved.           |
| `department_student_roster`, `student_scope_memberships`                         | Official identifier, name, section and linked active student account. Identifiers need not be consecutive. |
| `counselor_student_mappings`                                                     | Trusted effective-dated counselor allocation; editing a staff profile does not change it.                  |
| `activities`, `activity_assignments`, `activity_completions`, `activity_history` | One task, one row per assigned student, optional report/verification, actor and time history.              |
| `notifications`, `notification_outbox`                                           | Exact recipient inbox item and persisted job for optional desktop delivery.                                |

The [identity migration](../../supabase/migrations/20261026000100_identity_foundation.sql)
starts the trust model. The [Activity migration](../../supabase/migrations/20261027000100_activity_engine.sql)
adds the shared work model. Later numbered migrations add directory, workflow,
group and calendar behavior without replacing old tables. Read migrations in order;
the latest function definition may be in a later **forward correction**.

## RLS in simple terms

Row-level security is a database filter checked for the caller's session. When a
student queries Activities, SQL permits only rows assigned to that student. The
same underlying table can return different rows to a teacher, counselor or
student. RLS is backed by revoked direct-write grants and narrowly exposed SQL
functions. An API route passing a `studentId` does not override SQL scope checks.

For a Section A NPTEL Activity, the teacher's CREATE grant is checked against the
target section and category. The counselor's current mapping controls which of
those assigned students they can monitor. A HOD title alone does not grant private
overview; the `can_supervise` operation grant is separate. See
[permissions](../PERMISSIONS.md) and [the supervisor correction](../../supabase/migrations/20261028002200_supervisor_department_scope.sql).

## Transactions and constraints

`create_section_activity` writes the Activity, recipients and history together.
`submit_activity` locks an assignment before changing completion state. Unique
constraints stop two completion rows for one assignment. A failed history/outbox
write rolls back the operation, so the UI must not claim success. Effective dates,
foreign keys and mapping overlap constraints keep relationships consistent.

Most privileged SQL functions use `SECURITY DEFINER` with a fixed empty search
path and qualified table names. That elevates the function's database privileges,
which is why its checks of `auth.uid()`, current scope and exact operation must be
reviewed carefully. Do not make an editable profile field a permission source.

## Safe database changes

Already-applied migration files are history. Add a new numbered migration; do not
rewrite one and assume the local database will replay it. Review migration parity
first, apply only to an isolated database, then run `npm run test:rls` and
`npm run test:local`. [pgTAP files](FILE_INDEX.md) check grants, RLS and sensitive
function properties; integration suites check real Auth/API behavior. Never point
the local test wrapper at a hosted project.
