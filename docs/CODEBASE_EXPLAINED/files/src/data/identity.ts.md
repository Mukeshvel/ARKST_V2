# `src/data/identity.ts`

[Open the original file](../../../../../src/data/identity.ts) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

A server-only data access module for confirmed Auth users, active profiles and current responsibilities.

## B. Why does ARKST need it?

It supports confirmed Auth users, active profiles and current responsibilities. A signed-in teacher must still have an active approved profile and exact capability to assign students.

## C. How does it work?

It uses the authenticated Supabase client to query RLS-protected tables or call named SQL functions; the browser never receives an owner database key. Named declarations include `Profile`, `Responsibility`, `loadOwnIdentity`. Imported helpers called here: `IdentityError`.

## D. Which files does it connect to?

- [`src/auth/errors.ts`](../../../../../src/auth/errors.ts) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The connected modules listed below may need review and focused regression checks.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- identity` against the existing isolated local stack if this workflow changed.

## G. Important cautions

A valid sign-in is not permission to view other students. Keep the active-profile check, exact origin/session behavior and trusted database grants. Google provider exchange still needs external configuration and testing.
