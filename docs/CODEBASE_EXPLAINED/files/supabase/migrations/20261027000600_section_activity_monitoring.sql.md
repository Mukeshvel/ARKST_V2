# `supabase/migrations/20261027000600_section_activity_monitoring.sql`

[Open the original file](../../../../../supabase/migrations/20261027000600_section_activity_monitoring.sql) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

A forward-only PostgreSQL migration for one shared Activity, assignment and completion model.

## B. Why does ARKST need it?

It supports one shared Activity, assignment and completion model. A teacher assigns NPTEL work and assigned students report external completion.

## C. How does it work?

It changes database objects in version order. Identified objects: table: `activity_target_sections`; function: `can_monitor_created`, `can_read_activity`, `can_read_assignment`, `create_section_activity` (plus 2 more); policy: `history_visible`; index: `activity_target_sections_scope_idx`. The SQL is applied or asserted by the local Supabase CLI. Review the exact DDL/RLS/SQL assertions in the original file.

## D. Which files does it connect to?

- [`supabase/config.toml`](../../../../../supabase/config.toml) — a real imported or workflow-related file.
- [`supabase/tests/database/activity_security.test.sql`](../../../../../supabase/tests/database/activity_security.test.sql) — a real imported or workflow-related file.

## E. What happens if I modify this file?

Changing it after application would make database history disagree with Git. Use a new migration and rerun RLS/integration checks.

## F. How do I verify a safe change?

In the isolated local stack, confirm migration history, then run `npm run test:rls` and `npm run test:local`. Never reset a populated database just to test a migration.

## G. Important cautions

Already-applied migrations are historical records: add a new forward migration. Check RLS, grants, `SECURITY DEFINER` search paths and rollback behavior in a disposable environment.
