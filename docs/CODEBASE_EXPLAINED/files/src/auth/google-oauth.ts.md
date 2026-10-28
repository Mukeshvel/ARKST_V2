# `src/auth/google-oauth.ts`

[Open the original file](../../../../../src/auth/google-oauth.ts) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

A server-side authentication or request-boundary module for optional Google sign-in for approved existing accounts.

## B. Why does ARKST need it?

It supports optional Google sign-in for approved existing accounts. A signed-in teacher must still have an active approved profile and exact capability to assign students.

## C. How does it work?

It checks identity, cookies, origins, request shape or public error mapping before protected data is returned. Named declarations include `googleAuthorizationUrl`, `googleCallbackCode`, `url`, `code`.

## D. Which files does it connect to?

- [`src/auth/errors.ts`](../../../../../src/auth/errors.ts) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The connected modules listed below may need review and focused regression checks.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- session3` against the existing isolated local stack if this workflow changed.

## G. Important cautions

A valid sign-in is not permission to view other students. Keep the active-profile check, exact origin/session behavior and trusted database grants. Google provider exchange still needs external configuration and testing.
