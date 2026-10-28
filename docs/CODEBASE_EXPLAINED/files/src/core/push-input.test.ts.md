# `src/core/push-input.test.ts`

[Open the original file](../../../../../src/core/push-input.test.ts) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

A regression test for desktop push subscription and delivery.

## B. Why does ARKST need it?

It supports desktop push subscription and delivery. A newly assigned student gets an inbox entry; an opted-in browser may also receive a dispatched desktop push.

## C. How does it work?

It checks concrete behaviors such as accepts a supported HTTPS push service and bounded encryption keys; rejects missing or expired browser encryption details. Inspect the test setup to distinguish real local Auth/PostgreSQL/HTTP from pure in-process checks. Named declarations include `valid`. Examples of checks: accepts a supported HTTPS push service and bounded encryption keys; rejects missing or expired browser encryption details.

## D. Which files does it connect to?

- [`src/core/push-input.ts`](../../../../../src/core/push-input.ts) — a real imported or workflow-related file.

## E. What happens if I modify this file?

You change what regressions are detected, not the production feature itself. Keep the assertions tied to real rules.

## F. How do I verify a safe change?

Run `npm test` for unit/Node tests; use `npm run test:rls` for SQL pgTAP, and `npm run test:local` for real integration coverage.

## G. Important cautions

Do not weaken assertions to make a regression pass. Local synthetic accounts and controlled provider responses are not proof of hosted or desktop delivery.
