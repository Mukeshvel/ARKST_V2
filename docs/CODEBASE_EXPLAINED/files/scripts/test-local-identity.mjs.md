# `scripts/test-local-identity.mjs`

[Open the original file](../../../../scripts/test-local-identity.mjs) · [Back to file index](../../FILE_INDEX.md)

## A. What is this file?

A regression test for confirmed Auth users, active profiles and current responsibilities.

## B. Why does ARKST need it?

It supports confirmed Auth users, active profiles and current responsibilities. A signed-in teacher must still have an active approved profile and exact capability to assign students.

## C. How does it work?

It checks concrete behaviors such as email/password provider allows authentication without enabling public signup; anonymous application and direct database requests are denied. Inspect the test setup to distinguish real local Auth/PostgreSQL/HTTP from pure in-process checks. Named declarations include `main`, `config`, `options`, `admin`, `anonymous`, `database` and others. Examples of checks: email/password provider allows authentication without enabling public signup; anonymous application and direct database requests are denied; real authorized sign-in returns own database profile. API paths named here: `/api/me`.

## D. Which files does it connect to?

- [`tests/integration/local-helpers.mjs`](../../../../tests/integration/local-helpers.mjs) — a real imported or workflow-related file.
- [`package.json`](../../../../package.json) — a real imported or workflow-related file.

## E. What happens if I modify this file?

You change what regressions are detected, not the production feature itself. Keep the assertions tied to real rules.

## F. How do I verify a safe change?

Run `npm run test:local -- identity` through the existing local wrapper with the isolated Supabase stack; review fixture cleanup.

## G. Important cautions

Do not weaken assertions to make a regression pass. Local synthetic accounts and controlled provider responses are not proof of hosted or desktop delivery.
