# `supabase/migrations/20261028000700_attention_escalation.sql`

[Open the original file](../../../../../supabase/migrations/20261028000700_attention_escalation.sql) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

A forward-only PostgreSQL migration for staff attention and pending work.

## B. Why does ARKST need it?

It supports staff attention and pending work. A counselor contacts a pending student and later sees that follow-up resolve when the student reports completion.

## C. How does it work?

It changes database objects in version order. Identified objects: table: `escalation_routes`, `activity_escalations`, `activity_escalation_history`; function: `attention_needed`, `validate_escalation_route`, `current_escalation_recipient`, `can_view_escalation` (plus 4 more); policy: `escalation_scoped_read`, `escalation_history_scoped_read`; trigger: `escalation_route_validate`, `activity_completion_resolve_escalation`; index: `one_current_escalation_route`, `one_open_escalation_per_assignment`, `activity_escalation_assignment_time`, `activity_escalation_recipient_time` (plus 1 more). The SQL is applied or asserted by the local Supabase CLI. Review the exact DDL/RLS/SQL assertions in the original file.

## D. Which files does it connect to?

- [`supabase/config.toml`](../../../../../supabase/config.toml) — a real imported or workflow-related file.
- [`supabase/tests/database/workflow_security.test.sql`](../../../../../supabase/tests/database/workflow_security.test.sql) — a real imported or workflow-related file.

## E. What happens if I modify this file?

Changing it after application would make database history disagree with Git. Use a new migration and rerun RLS/integration checks.

## F. How do I verify a safe change?

In the isolated local stack, confirm migration history, then run `npm run test:rls` and `npm run test:local`. Never reset a populated database just to test a migration.

## G. Important cautions

Already-applied migrations are historical records: add a new forward migration. Check RLS, grants, `SECURITY DEFINER` search paths and rollback behavior in a disposable environment.
