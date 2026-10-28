# `supabase/migrations/20261028002200_supervisor_department_scope.sql`

[Open the original file](../../../../../supabase/migrations/20261028002200_supervisor_department_scope.sql) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

A forward-only PostgreSQL migration for department and counselor progress over existing assignments.

## B. Why does ARKST need it?

It supports department and counselor progress over existing assignments. An explicitly approved HOD checks department and current counselor progress.

## C. How does it work?

It changes database objects in version order. Identified objects: function: `activity_in_department`, `supervisory_overview`, `supervisory_student_detail`. The SQL is applied or asserted by the local Supabase CLI. Review the exact DDL/RLS/SQL assertions in the original file. This forward correction confines supervisor counts and detail to Activities originating in the granted department, including after a student transfer. It preserves the same source records and does not add an Activity-specific counselor aggregate.

## D. Which files does it connect to?

- [`supabase/config.toml`](../../../../../supabase/config.toml) — a real imported or workflow-related file.
- [`supabase/tests/database/session2_security.test.sql`](../../../../../supabase/tests/database/session2_security.test.sql) — a real imported or workflow-related file.

## E. What happens if I modify this file?

Changing it after application would make database history disagree with Git. Use a new migration and rerun RLS/integration checks.

## F. How do I verify a safe change?

In the isolated local stack, confirm migration history, then run `npm run test:rls` and `npm run test:local`. Never reset a populated database just to test a migration.

## G. Important cautions

Already-applied migrations are historical records: add a new forward migration. Check RLS, grants, `SECURITY DEFINER` search paths and rollback behavior in a disposable environment.
