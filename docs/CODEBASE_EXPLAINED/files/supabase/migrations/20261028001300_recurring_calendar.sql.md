# `supabase/migrations/20261028001300_recurring_calendar.sql`

[Open the original file](../../../../../supabase/migrations/20261028001300_recurring_calendar.sql) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

A forward-only PostgreSQL migration for recurring external tests, schedule windows and exam blackouts.

## B. Why does ARKST need it?

It supports recurring external tests, schedule windows and exam blackouts. A coordinator configures an external weekly test; a blackout can stop a future occurrence before students are assigned.

## C. How does it work?

It changes database objects in version order. Identified objects: table: `recurring_schedules`, `recurring_schedule_sections`, `recurring_schedule_slots`, `academic_blackouts` (plus 2 more); function: `validate_recurring_relationships`, `create_recurring_schedule`, `configure_recurring_schedule`, `set_recurring_schedule_paused` (plus 7 more); trigger: `recurring_schedule_validate`, `recurring_section_validate`, `recurring_slot_validate`, `blackout_validate`; index: `unique_department_schedule_name`, `blackout_department_window`, `recurring_instances_window`, `activity_window_changes_activity`. The SQL is applied or asserted by the local Supabase CLI. Review the exact DDL/RLS/SQL assertions in the original file. Configurable schedules, slots, sections, blackout periods and occurrences feed the existing section Activity publisher. Unique occurrence keys and locks make repeated generation idempotent; blocked windows create no Activity or associated notice.

## D. Which files does it connect to?

- [`supabase/config.toml`](../../../../../supabase/config.toml) — a real imported or workflow-related file.
- [`supabase/tests/database/session2_security.test.sql`](../../../../../supabase/tests/database/session2_security.test.sql) — a real imported or workflow-related file.

## E. What happens if I modify this file?

Changing it after application would make database history disagree with Git. Use a new migration and rerun RLS/integration checks.

## F. How do I verify a safe change?

In the isolated local stack, confirm migration history, then run `npm run test:rls` and `npm run test:local`. Never reset a populated database just to test a migration.

## G. Important cautions

Already-applied migrations are historical records: add a new forward migration. Check RLS, grants, `SECURITY DEFINER` search paths and rollback behavior in a disposable environment.
