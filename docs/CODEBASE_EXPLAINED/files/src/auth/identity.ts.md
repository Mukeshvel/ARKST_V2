# `src/auth/identity.ts`

[Open the original file](../../../../../src/auth/identity.ts) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

A server-side authentication or request-boundary module for confirmed Auth users, active profiles and current responsibilities.

## B. Why does ARKST need it?

It supports confirmed Auth users, active profiles and current responsibilities. A signed-in teacher must still have an active approved profile and exact capability to assign students.

## C. How does it work?

It checks identity, cookies, origins, request shape or public error mapping before protected data is returned. Named declarations include `requireOwnIdentity`, `client`. Imported helpers called here: `loadOwnIdentity`. `requireOwnIdentity` checks both `getClaims()` and `getUser()`, compares their user IDs, and then loads only the matching active database profile. This prevents a decoded JWT alone or a self-described role from opening private records.

## D. Which files does it connect to?

- [`src/auth/server.ts`](../../../../../src/auth/server.ts) — a real imported or workflow-related file.
- [`src/auth/errors.ts`](../../../../../src/auth/errors.ts) — a real imported or workflow-related file.
- [`src/data/identity.ts`](../../../../../src/data/identity.ts) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The connected modules listed below may need review and focused regression checks.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- identity` against the existing isolated local stack if this workflow changed.

## G. Important cautions

A valid sign-in is not permission to view other students. Keep the active-profile check, exact origin/session behavior and trusted database grants. Google provider exchange still needs external configuration and testing.
