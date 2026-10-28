# `supabase/migrations/20261028001500_calendar_lock_and_group_edit.sql`

[Open the original file](../../../../../supabase/migrations/20261028001500_calendar_lock_and_group_edit.sql) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

A forward-only PostgreSQL migration for recurring external tests, schedule windows and exam blackouts.

## B. Why does ARKST need it?

It supports recurring external tests, schedule windows and exam blackouts. A coordinator configures an external weekly test; a blackout can stop a future occurrence before students are assigned.

## C. How does it work?

It changes database objects in version order. Identified objects: table: `academic_group_changes`; function: `run_due_recurring_schedule`, `lock_blackout_department`, `calendar_available_sections`, `update_academic_group`; trigger: `blackout_department_lock`; index: `group_changes_group_time`. The SQL is applied or asserted by the local Supabase CLI. Review the exact DDL/RLS/SQL assertions in the original file.

## D. Which files does it connect to?

- [`supabase/config.toml`](../../../../../supabase/config.toml) — a real imported or workflow-related file.
- [`supabase/tests/database/session2_security.test.sql`](../../../../../supabase/tests/database/session2_security.test.sql) — a real imported or workflow-related file.

## E. What happens if I modify this file?

Changing it after application would make database history disagree with Git. Use a new migration and rerun RLS/integration checks.

## F. How do I verify a safe change?

In the isolated local stack, confirm migration history, then run `npm run test:rls` and `npm run test:local`. Never reset a populated database just to test a migration.

## G. Important cautions

Already-applied migrations are historical records: add a new forward migration. Check RLS, grants, `SECURITY DEFINER` search paths and rollback behavior in a disposable environment.
