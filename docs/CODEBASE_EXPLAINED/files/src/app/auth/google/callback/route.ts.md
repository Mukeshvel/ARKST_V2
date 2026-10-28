# `src/app/auth/google/callback/route.ts`

[Open the original file](../../../../../../../../src/app/auth/google/callback/route.ts) · [Back to file index](../../../../../../FILE_INDEX.md)

## A. What is this file?

The server-side `/auth/google/callback` sign-in or sign-out handler.

## B. Why does ARKST need it?

It supports optional Google sign-in for approved existing accounts. A signed-in teacher must still have an active approved profile and exact capability to assign students.

## C. How does it work?

It handles a real Auth exchange and session cookies for optional Google sign-in for approved existing accounts; inspect its origin checks and redirect handling before changing it. HTTP methods: GET. Named declarations include `GET`, `code`, `client`, `exchange`, `user`. Imported helpers called here: `createIdentityClient`, `clearApplicationSession`, `identityConfig`, `googleCallbackCode`, `loadOwnIdentity`. The callback exchanges the code for a real Supabase session, confirms the Auth user and confirmed email, and requires an active ARKST profile. On failure it clears local session cookies and redirects with a fixed error reason. A live Google provider exchange has not been verified.

## D. Which files does it connect to?

- [`src/auth/server.ts`](../../../../../../../../src/auth/server.ts) — a real imported or workflow-related file.
- [`src/auth/google-oauth.ts`](../../../../../../../../src/auth/google-oauth.ts) — a real imported or workflow-related file.
- [`src/data/identity.ts`](../../../../../../../../src/data/identity.ts) — a real imported or workflow-related file.
- [`src/auth/http.ts`](../../../../../../../../src/auth/http.ts) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The connected modules listed below may need review and focused regression checks.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- session3` against the existing isolated local stack if this workflow changed.

## G. Important cautions

A valid sign-in is not permission to view other students. Keep the active-profile check, exact origin/session behavior and trusted database grants. Google provider exchange still needs external configuration and testing.
