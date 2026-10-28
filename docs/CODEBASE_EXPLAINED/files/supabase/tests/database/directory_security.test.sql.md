# `supabase/tests/database/directory_security.test.sql`

[Open the original file](../../../../../../supabase/tests/database/directory_security.test.sql) · [Back to file index](../../../../FILE_INDEX.md)

## A. What is this file?

A pgTAP security regression file for staff profiles, roster data and trusted mappings.

## B. Why does ARKST need it?

It supports staff profiles, roster data and trusted mappings. An administrator imports approved names and sections, then links them to existing confirmed accounts.

## C. How does it work?

It asserts database grants, RLS or trusted functions. The source contains at least 30 recognizable pgTAP check calls; read each assertion for its exact guarantee. The SQL is applied or asserted by the local Supabase CLI. Review the exact DDL/RLS/SQL assertions in the original file.

## D. Which files does it connect to?

- [`supabase/config.toml`](../../../../../../supabase/config.toml) — a real imported or workflow-related file.
- [`supabase/migrations/20261026000100_identity_foundation.sql`](../../../../../../supabase/migrations/20261026000100_identity_foundation.sql) — a real imported or workflow-related file.

## E. What happens if I modify this file?

You change what regressions are detected, not the production feature itself. Keep the assertions tied to real rules.

## F. How do I verify a safe change?

In the isolated local stack, confirm migration history, then run `npm run test:rls` and `npm run test:local`. Never reset a populated database just to test a migration.

## G. Important cautions

Do not weaken assertions to make a regression pass. Local synthetic accounts and controlled provider responses are not proof of hosted or desktop delivery.
