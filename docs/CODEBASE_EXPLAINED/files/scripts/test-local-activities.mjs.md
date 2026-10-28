# `scripts/test-local-activities.mjs`

[Open the original file](../../../../scripts/test-local-activities.mjs) · [Back to file index](../../FILE_INDEX.md)

## A. What is this file?

A regression test for one shared Activity, assignment and completion model.

## B. Why does ARKST need it?

It supports one shared Activity, assignment and completion model. A teacher assigns NPTEL work and assigned students report external completion.

## C. How does it work?

It checks concrete behaviors such as authorized staff creates a persisted activity, direct assignments and actor history atomically; anonymous, student, role-only admin and verify-only staff cannot create. Inspect the test setup to distinguish real local Auth/PostgreSQL/HTTP from pure in-process checks. Named declarations include `main`, `config`, `runId`, `options`, `admin`, `anonymous` and others. Examples of checks: authorized staff creates a persisted activity, direct assignments and actor history atomically; anonymous, student, role-only admin and verify-only staff cannot create; every target, category and exact scope is checked without hierarchy or combined-role escalation. Supabase RPCs named here: `create_activity`, `submit_activity`, `verify_activity`. API paths named here: `/api/activities`, `/api/activities/not-a-uuid`, `/api/activities?offset=0`, `/api/activities?offset=500`.

## D. Which files does it connect to?

- [`tests/integration/local-helpers.mjs`](../../../../tests/integration/local-helpers.mjs) — a real imported or workflow-related file.
- [`package.json`](../../../../package.json) — a real imported or workflow-related file.

## E. What happens if I modify this file?

You change what regressions are detected, not the production feature itself. Keep the assertions tied to real rules.

## F. How do I verify a safe change?

Run `npm run test:local -- activity` through the existing local wrapper with the isolated Supabase stack; review fixture cleanup.

## G. Important cautions

Do not weaken assertions to make a regression pass. Local synthetic accounts and controlled provider responses are not proof of hosted or desktop delivery.
