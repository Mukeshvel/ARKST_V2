# `src/app/dashboard/dashboard-data.test.ts`

[Open the original file](../../../../../../src/app/dashboard/dashboard-data.test.ts) · [Back to file index](../../../../FILE_INDEX.md)

## A. What is this file?

A regression test for the ARKST application or its development workflow.

## B. Why does ARKST need it?

Dashboard date and completion labels must match real saved states.

## C. How does it work?

It checks concrete behaviors such as uses the inclusive start and exclusive deadline for unreported work; keeps a verification-required report awaiting even after the deadline. Inspect the test setup to distinguish real local Auth/PostgreSQL/HTTP from pure in-process checks. Named declarations include `Activity`, `Assignment`, `activity`, `assignment`, `reported`. Examples of checks: uses the inclusive start and exclusive deadline for unreported work; keeps a verification-required report awaiting even after the deadline.

## D. Which files does it connect to?

- [`src/app/dashboard/dashboard-data.ts`](../../../../../../src/app/dashboard/dashboard-data.ts) — a real imported or workflow-related file.
- [`src/app/dashboard/dashboard-nav.tsx`](../../../../../../src/app/dashboard/dashboard-nav.tsx) — a real imported or workflow-related file.

## E. What happens if I modify this file?

You change what regressions are detected, not the production feature itself. Keep the assertions tied to real rules.

## F. How do I verify a safe change?

Run `npm test` for unit/Node tests; use `npm run test:rls` for SQL pgTAP, and `npm run test:local` for real integration coverage.

## G. Important cautions

Do not weaken assertions to make a regression pass. Local synthetic accounts and controlled provider responses are not proof of hosted or desktop delivery.
