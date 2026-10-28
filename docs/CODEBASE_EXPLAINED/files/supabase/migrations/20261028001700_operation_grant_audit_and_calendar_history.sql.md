# `supabase/migrations/20261028001700_operation_grant_audit_and_calendar_history.sql`

[Open the original file](../../../../../supabase/migrations/20261028001700_operation_grant_audit_and_calendar_history.sql) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

A forward-only PostgreSQL migration for recurring external tests, schedule windows and exam blackouts.

## B. Why does ARKST need it?

It supports recurring external tests, schedule windows and exam blackouts. A coordinator configures an external weekly test; a blackout can stop a future occurrence before students are assigned.

## C. How does it work?

It changes database objects in version order. Identified objects: table: `department_operation_grant_history`; function: `calendar_instance_history`; index: `department_operation_grant_history_responsibility`. The SQL is applied or asserted by the local Supabase CLI. Review the exact DDL/RLS/SQL assertions in the original file.

## D. Which files does it connect to?

- [`supabase/config.toml`](../../../../../supabase/config.toml) — a real imported or workflow-related file.
- [`supabase/tests/database/session2_security.test.sql`](../../../../../supabase/tests/database/session2_security.test.sql) — a real imported or workflow-related file.

## E. What happens if I modify this file?

Changing it after application would make database history disagree with Git. Use a new migration and rerun RLS/integration checks.

## F. How do I verify a safe change?

In the isolated local stack, confirm migration history, then run `npm run test:rls` and `npm run test:local`. Never reset a populated database just to test a migration.

## G. Important cautions

Already-applied migrations are historical records: add a new forward migration. Check RLS, grants, `SECURITY DEFINER` search paths and rollback behavior in a disposable environment.
