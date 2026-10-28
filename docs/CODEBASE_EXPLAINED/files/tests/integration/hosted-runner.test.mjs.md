# `tests/integration/hosted-runner.test.mjs`

[Open the original file](../../../../../tests/integration/hosted-runner.test.mjs) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

A regression test for the ARKST application or its development workflow.

## B. Why does ARKST need it?

A hosted calendar command must reject unsafe settings before it can publish test instances.

## C. How does it work?

It checks concrete behaviors such as hosted runner refuses local, HTTP, missing credentials and implicit activation; runner uses only granted unpaused schedules and reports database failures. Inspect the test setup to distinguish real local Auth/PostgreSQL/HTTP from pure in-process checks. Named declarations include `env`, `bad`, `calls`, `client`. Examples of checks: hosted runner refuses local, HTTP, missing credentials and implicit activation; runner uses only granted unpaused schedules and reports database failures; hosted horizon follows the schedule timezone.

## D. Which files does it connect to?

- [`scripts/run-recurring-hosted.mjs`](../../../../../scripts/run-recurring-hosted.mjs) — a real imported or workflow-related file.
- [`scripts/lib/recurring-runner.mjs`](../../../../../scripts/lib/recurring-runner.mjs) — a real imported or workflow-related file.
- [`package.json`](../../../../../package.json) — a real imported or workflow-related file.

## E. What happens if I modify this file?

You change what regressions are detected, not the production feature itself. Keep the assertions tied to real rules.

## F. How do I verify a safe change?

Run `npm test` for unit/Node tests; use `npm run test:rls` for SQL pgTAP, and `npm run test:local` for real integration coverage.

## G. Important cautions

Do not weaken assertions to make a regression pass. Local synthetic accounts and controlled provider responses are not proof of hosted or desktop delivery.
