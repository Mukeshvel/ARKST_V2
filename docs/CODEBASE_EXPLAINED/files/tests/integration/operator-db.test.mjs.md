# `tests/integration/operator-db.test.mjs`

[Open the original file](../../../../../tests/integration/operator-db.test.mjs) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

A regression test for the ARKST application or its development workflow.

## B. Why does ARKST need it?

Trusted owner connections must require explicit host matching and TLS in hosted mode.

## C. How does it work?

It checks concrete behaviors such as operator connection defaults to loopback and rejects remote without explicit hosted mode; hosted push database URL requires exact host and rejects SSL override parameters. Inspect the test setup to distinguish real local Auth/PostgreSQL/HTTP from pure in-process checks. Named declarations include `env`, `config`. Examples of checks: operator connection defaults to loopback and rejects remote without explicit hosted mode; hosted push database URL requires exact host and rejects SSL override parameters; hosted operator requires explicit mode, exact host and verified TLS.

## D. Which files does it connect to?

- [`scripts/lib/operator-db.mjs`](../../../../../scripts/lib/operator-db.mjs) — a real imported or workflow-related file.
- [`scripts/lib/hosted-db.mjs`](../../../../../scripts/lib/hosted-db.mjs) — a real imported or workflow-related file.
- [`package.json`](../../../../../package.json) — a real imported or workflow-related file.

## E. What happens if I modify this file?

You change what regressions are detected, not the production feature itself. Keep the assertions tied to real rules.

## F. How do I verify a safe change?

Run `npm test` for unit/Node tests; use `npm run test:rls` for SQL pgTAP, and `npm run test:local` for real integration coverage.

## G. Important cautions

Do not weaken assertions to make a regression pass. Local synthetic accounts and controlled provider responses are not proof of hosted or desktop delivery.
