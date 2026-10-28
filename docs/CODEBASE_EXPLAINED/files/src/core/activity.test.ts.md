# `src/core/activity.test.ts`

[Open the original file](../../../../../src/core/activity.test.ts) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

A regression test for one shared Activity, assignment and completion model.

## B. Why does ARKST need it?

It supports one shared Activity, assignment and completion model. A teacher assigns NPTEL work and assigned students report external completion.

## C. How does it work?

It checks concrete behaviors such as compares equivalent instants across offsets; rejects equal or reversed windows. Inspect the test setup to distinguish real local Auth/PostgreSQL/HTTP from pure in-process checks. Named declarations include `window`. Examples of checks: compares equivalent instants across offsets; rejects equal or reversed windows; rejects invalid instants.

## D. Which files does it connect to?

- [`src/core/activity.ts`](../../../../../src/core/activity.ts) — a real imported or workflow-related file.

## E. What happens if I modify this file?

You change what regressions are detected, not the production feature itself. Keep the assertions tied to real rules.

## F. How do I verify a safe change?

Run `npm test` for unit/Node tests; use `npm run test:rls` for SQL pgTAP, and `npm run test:local` for real integration coverage.

## G. Important cautions

Do not weaken assertions to make a regression pass. Local synthetic accounts and controlled provider responses are not proof of hosted or desktop delivery.
