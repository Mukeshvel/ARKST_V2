# `supabase/migrations/20261028002500_activity_supervision.sql`

[Source](../../../../../supabase/migrations/20261028002500_activity_supervision.sql)

## A. What is this file?

Adds a read-only, selected-Activity supervisory RPC.

## B. Why does ARKST need it?

An approved HOD chooses one NPTEL assignment and sees counselor totals.

## C. How does it work?

supervisory_activity_overview checks the existing exact-department supervision grant and validates the section and Activity origin. With no Activity it returns department Activity options. With an Activity it joins durable assignments, completions and active roster membership. A current trusted mapping determines each counselor; missing or expired mappings form one unmapped row. GROUPING SETS computes counselor and scope totals before the 50-student page. Reported includes every submission, awaiting verification and verified are explicit subsets, and pending includes overdue work.

## D. Which files does it connect to?

- [`supabase/migrations/20261028002200_supervisor_department_scope.sql`](../../../../../supabase/migrations/20261028002200_supervisor_department_scope.sql)
- [`src/app/api/supervision/activities/route.ts`](../../../../../src/app/api/supervision/activities/route.ts)
- [`supabase/tests/database/session2_security.test.sql`](../../../../../supabase/tests/database/session2_security.test.sql)

## E. What happens if I modify this file?

Changing this privileged query can expose private student records or corrupt counts. Do not remove the active roster, membership, Activity-origin or capability predicates.

## F. How do I verify a safe change?

npm run test:rls; APP_ENV=local LOCAL_IDENTITY_TESTS=1 npm run test:local -- session2 (set environment variables using your shell).

## G. Important cautions

Forward-only migration; do not rewrite it after applying. SECURITY DEFINER uses an empty search path and grants execution only to authenticated callers. No stored assignment or mapping is changed.
