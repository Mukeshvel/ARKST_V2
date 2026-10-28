# `src/core/staff-directory-input.test.ts`

[Open the original file](../../../../../src/core/staff-directory-input.test.ts) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

A regression test for staff profiles, roster data and trusted mappings.

## B. Why does ARKST need it?

It supports staff profiles, roster data and trusted mappings. An administrator imports approved names and sections, then links them to existing confirmed accounts.

## C. How does it work?

It checks concrete behaviors such as accepts descriptive custom designations and both sections without turning them into roles; accepts the bounded default and a later page. Inspect the test setup to distinguish real local Auth/PostgreSQL/HTTP from pure in-process checks. Named declarations include `valid`. Examples of checks: accepts descriptive custom designations and both sections without turning them into roles; accepts the bounded default and a later page.

## D. Which files does it connect to?

- [`src/core/staff-directory-input.ts`](../../../../../src/core/staff-directory-input.ts) — a real imported or workflow-related file.

## E. What happens if I modify this file?

You change what regressions are detected, not the production feature itself. Keep the assertions tied to real rules.

## F. How do I verify a safe change?

Run `npm test` for unit/Node tests; use `npm run test:rls` for SQL pgTAP, and `npm run test:local` for real integration coverage.

## G. Important cautions

Do not weaken assertions to make a regression pass. Local synthetic accounts and controlled provider responses are not proof of hosted or desktop delivery.
