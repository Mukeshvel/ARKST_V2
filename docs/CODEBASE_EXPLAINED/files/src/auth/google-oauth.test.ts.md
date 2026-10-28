# `src/auth/google-oauth.test.ts`

[Open the original file](../../../../../src/auth/google-oauth.test.ts) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

A regression test for optional Google sign-in for approved existing accounts.

## B. Why does ARKST need it?

It supports optional Google sign-in for approved existing accounts. A signed-in teacher must still have an active approved profile and exact capability to assign students.

## C. How does it work?

It checks concrete behaviors such as accepts only the expected Google authorize URL and exact callback; accepts only one callback code on the exact app origin. Inspect the test setup to distinguish real local Auth/PostgreSQL/HTTP from pure in-process checks. Named declarations include `origin`, `callback`, `url`, `altered`. Examples of checks: accepts only the expected Google authorize URL and exact callback; accepts only one callback code on the exact app origin.

## D. Which files does it connect to?

- [`src/auth/google-oauth.ts`](../../../../../src/auth/google-oauth.ts) — a real imported or workflow-related file.

## E. What happens if I modify this file?

You change what regressions are detected, not the production feature itself. Keep the assertions tied to real rules.

## F. How do I verify a safe change?

Run `npm test` for unit/Node tests; use `npm run test:rls` for SQL pgTAP, and `npm run test:local` for real integration coverage.

## G. Important cautions

Do not weaken assertions to make a regression pass. Local synthetic accounts and controlled provider responses are not proof of hosted or desktop delivery.
