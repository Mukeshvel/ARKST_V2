# `src/core/activity-input.test.ts`

[Open the original file](../../../../../src/core/activity-input.test.ts) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

A regression test for one shared Activity, assignment and completion model.

## B. Why does ARKST need it?

It supports one shared Activity, assignment and completion model. A teacher assigns NPTEL work and assigned students report external completion.

## C. How does it work?

It checks concrete behaviors such as accepts configurable UTC windows and extensible category keys; bounds and validates pagination without allowing identity filters. Inspect the test setup to distinguish real local Auth/PostgreSQL/HTTP from pure in-process checks. Named declarations include `valid`, `query`, `selected`, `parsed`, `change`, `base` and others. Examples of checks: accepts configurable UTC windows and extensible category keys; bounds and validates pagination without allowing identity filters; accepts one explicit selected audience with existing Activity dates.

## D. Which files does it connect to?

- [`src/core/activity-input.ts`](../../../../../src/core/activity-input.ts) — a real imported or workflow-related file.

## E. What happens if I modify this file?

You change what regressions are detected, not the production feature itself. Keep the assertions tied to real rules.

## F. How do I verify a safe change?

Run `npm test` for unit/Node tests; use `npm run test:rls` for SQL pgTAP, and `npm run test:local` for real integration coverage.

## G. Important cautions

Do not weaken assertions to make a regression pass. Local synthetic accounts and controlled provider responses are not proof of hosted or desktop delivery.
