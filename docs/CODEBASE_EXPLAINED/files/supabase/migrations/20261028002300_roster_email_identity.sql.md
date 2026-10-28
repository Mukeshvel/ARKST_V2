# `supabase/migrations/20261028002300_roster_email_identity.sql`

[Open the original file](../../../../../supabase/migrations/20261028002300_roster_email_identity.sql) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

A forward-only PostgreSQL migration for the official student directory and account linking.

## B. Why does ARKST need it?

It supports the official student directory and account linking. An administrator imports approved names and sections, then links them to existing confirmed accounts.

## C. How does it work?

It changes database objects in version order. Identified objects: index: `department_roster_unique_institutional_email`. The SQL is applied or asserted by the local Supabase CLI. Review the exact DDL/RLS/SQL assertions in the original file.

## D. Which files does it connect to?

- [`supabase/config.toml`](../../../../../supabase/config.toml) — a real imported or workflow-related file.
- [`supabase/tests/database/identity_rls.test.sql`](../../../../../supabase/tests/database/identity_rls.test.sql) — a real imported or workflow-related file.

## E. What happens if I modify this file?

Changing it after application would make database history disagree with Git. Use a new migration and rerun RLS/integration checks.

## F. How do I verify a safe change?

In the isolated local stack, confirm migration history, then run `npm run test:rls` and `npm run test:local`. Never reset a populated database just to test a migration.

## G. Important cautions

Already-applied migrations are historical records: add a new forward migration. Check RLS, grants, `SECURITY DEFINER` search paths and rollback behavior in a disposable environment.
