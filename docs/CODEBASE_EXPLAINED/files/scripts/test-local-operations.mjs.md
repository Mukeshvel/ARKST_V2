# `scripts/test-local-operations.mjs`

[Open the original file](../../../../scripts/test-local-operations.mjs) · [Back to file index](../../FILE_INDEX.md)

## A. What is this file?

A regression test for section publication, announcements and monitoring.

## B. Why does ARKST need it?

It supports section publication, announcements and monitoring. A programmer uses it to operate or maintain the same college application safely.

## C. How does it work?

It checks concrete behaviors such as anonymous requests cannot read or publish operational records; candidate search exposes only real eligible names in current CREATE scope. Inspect the test setup to distinguish real local Auth/PostgreSQL/HTTP from pure in-process checks. Named declarations include `main`, `config`, `tag`, `options`, `admin`, `db` and others. Examples of checks: anonymous requests cannot read or publish operational records; candidate search exposes only real eligible names in current CREATE scope; six exact assignments and inbox/outbox events persist without unrelated recipients. API paths named here: `/api/notifications`, `/api/announcements`, `/api/counselor/activity-summaries`, `/api/activities/selected`.

## D. Which files does it connect to?

- [`tests/integration/local-helpers.mjs`](../../../../tests/integration/local-helpers.mjs) — a real imported or workflow-related file.
- [`package.json`](../../../../package.json) — a real imported or workflow-related file.

## E. What happens if I modify this file?

You change what regressions are detected, not the production feature itself. Keep the assertions tied to real rules.

## F. How do I verify a safe change?

Run `npm run test:local -- operations` through the existing local wrapper with the isolated Supabase stack; review fixture cleanup.

## G. Important cautions

Do not weaken assertions to make a regression pass. Local synthetic accounts and controlled provider responses are not proof of hosted or desktop delivery.
