# `supabase/migrations/20261026000100_identity_foundation.sql`

[Open the original file](../../../../../supabase/migrations/20261026000100_identity_foundation.sql) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

A forward-only PostgreSQL migration for confirmed Auth users, active profiles and current responsibilities.

## B. Why does ARKST need it?

It supports confirmed Auth users, active profiles and current responsibilities. A signed-in teacher must still have an active approved profile and exact capability to assign students.

## C. How does it work?

It changes database objects in version order. Identified objects: table: `profiles`, `scopes`, `responsibility_assignments`; policy: `own_active_profile`, `own_current_responsibilities`, `scopes_of_own_current_responsibilities`; index: `scopes_parent_idx`, `responsibilities_user_idx`, `responsibilities_scope_idx`. The SQL is applied or asserted by the local Supabase CLI. Review the exact DDL/RLS/SQL assertions in the original file. This foundation defines active profiles, scopes and effective-dated responsibilities. RLS and grants restrict ordinary users to their own active identity; administrator authority is a trusted record, not an email prefix or profile field.

## D. Which files does it connect to?

- [`supabase/config.toml`](../../../../../supabase/config.toml) — a real imported or workflow-related file.
- [`supabase/tests/database/identity_rls.test.sql`](../../../../../supabase/tests/database/identity_rls.test.sql) — a real imported or workflow-related file.

## E. What happens if I modify this file?

Changing it after application would make database history disagree with Git. Use a new migration and rerun RLS/integration checks.

## F. How do I verify a safe change?

In the isolated local stack, confirm migration history, then run `npm run test:rls` and `npm run test:local`. Never reset a populated database just to test a migration.

## G. Important cautions

Already-applied migrations are historical records: add a new forward migration. Check RLS, grants, `SECURITY DEFINER` search paths and rollback behavior in a disposable environment.
