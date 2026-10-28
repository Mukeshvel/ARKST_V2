# `src/config/identity.ts`

[Open the original file](../../../../../src/config/identity.ts) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

Configuration validation for confirmed Auth users, active profiles and current responsibilities.

## B. Why does ARKST need it?

It supports confirmed Auth users, active profiles and current responsibilities. A signed-in teacher must still have an active approved profile and exact capability to assign students.

## C. How does it work?

It reads and checks environment values before runtime code uses them. Named declarations include `IdentityConfigurationError`, `isLoopback`, `parseIdentityEnvironment`, `url`, `key`, `invalid` and others.

## D. Which files does it connect to?

- No direct project-file import is present; follow the configured tool or route that reads this file.

## E. What happens if I modify this file?

The connected modules listed below may need review and focused regression checks.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- identity` against the existing isolated local stack if this workflow changed.

## G. Important cautions

A valid sign-in is not permission to view other students. Keep the active-profile check, exact origin/session behavior and trusted database grants. Google provider exchange still needs external configuration and testing.
