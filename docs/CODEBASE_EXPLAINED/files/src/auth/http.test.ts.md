# `src/auth/http.test.ts`

[Open the original file](../../../../../src/auth/http.test.ts) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

A regression test for real sign-in, session checks and account authorization.

## B. Why does ARKST need it?

It supports real sign-in, session checks and account authorization. A signed-in teacher must still have an active approved profile and exact capability to assign students.

## C. How does it work?

It checks concrete behaviors such as accepts exact same-origin mutation; parses credentials without changing the password. Inspect the test setup to distinguish real local Auth/PostgreSQL/HTTP from pure in-process checks. Named declarations include `origin`, `request`. Examples of checks: accepts exact same-origin mutation; parses credentials without changing the password; rejects JSON login submissions.

## D. Which files does it connect to?

- [`src/auth/http.ts`](../../../../../src/auth/http.ts) — a real imported or workflow-related file.

## E. What happens if I modify this file?

You change what regressions are detected, not the production feature itself. Keep the assertions tied to real rules.

## F. How do I verify a safe change?

Run `npm test` for unit/Node tests; use `npm run test:rls` for SQL pgTAP, and `npm run test:local` for real integration coverage.

## G. Important cautions

Do not weaken assertions to make a regression pass. Local synthetic accounts and controlled provider responses are not proof of hosted or desktop delivery.
