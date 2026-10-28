# `tests/integration/local-helpers.test.mjs`

[Open the original file](../../../../../tests/integration/local-helpers.test.mjs) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

A regression test for the ARKST application or its development workflow.

## B. Why does ARKST need it?

The loopback guard must reject remote URLs and malformed local configuration.

## C. How does it work?

It checks concrete behaviors such as requires explicit disposable local environment opt-in; accepts only an explicitly configured local stack. Inspect the test setup to distinguish real local Auth/PostgreSQL/HTTP from pure in-process checks. Named declarations include `env`, `name`, `remote`. Examples of checks: requires explicit disposable local environment opt-in; accepts only an explicitly configured local stack; rejects URL parameters that could override database connection targets.

## D. Which files does it connect to?

- [`tests/integration/local-helpers.mjs`](../../../../../tests/integration/local-helpers.mjs) — a real imported or workflow-related file.
- [`package.json`](../../../../../package.json) — a real imported or workflow-related file.

## E. What happens if I modify this file?

You change what regressions are detected, not the production feature itself. Keep the assertions tied to real rules.

## F. How do I verify a safe change?

Run `npm test` for unit/Node tests; use `npm run test:rls` for SQL pgTAP, and `npm run test:local` for real integration coverage.

## G. Important cautions

Do not weaken assertions to make a regression pass. Local synthetic accounts and controlled provider responses are not proof of hosted or desktop delivery.
