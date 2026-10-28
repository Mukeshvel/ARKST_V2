# `src/app/auth/google/route.ts`

[Open the original file](../../../../../../../src/app/auth/google/route.ts) · [Back to file index](../../../../../FILE_INDEX.md)

## A. What is this file?

The server-side `/auth/google` sign-in or sign-out handler.

## B. Why does ARKST need it?

It supports optional Google sign-in for approved existing accounts. A signed-in teacher must still have an active approved profile and exact capability to assign students.

## C. How does it work?

It handles a real Auth exchange and session cookies for optional Google sign-in for approved existing accounts; inspect its origin checks and redirect handling before changing it. HTTP methods: POST. Named declarations include `POST`, `config`, `callback`, `client`, `url`, `failure`. Imported helpers called here: `createIdentityClient`, `identityConfig`, `googleAuthorizationUrl`, `IdentityError`, `publicIdentityError`, `requireSameOrigin`. The POST start route requires the exact app Origin and `GOOGLE_OAUTH_ENABLED`. Supabase creates a PKCE verifier cookie and an authorization URL, which the app validates before issuing a 303 redirect.

## D. Which files does it connect to?

- [`src/auth/server.ts`](../../../../../../../src/auth/server.ts) — a real imported or workflow-related file.
- [`src/auth/google-oauth.ts`](../../../../../../../src/auth/google-oauth.ts) — a real imported or workflow-related file.
- [`src/auth/errors.ts`](../../../../../../../src/auth/errors.ts) — a real imported or workflow-related file.
- [`src/auth/http.ts`](../../../../../../../src/auth/http.ts) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The connected modules listed below may need review and focused regression checks.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- session3` against the existing isolated local stack if this workflow changed.

## G. Important cautions

A valid sign-in is not permission to view other students. Keep the active-profile check, exact origin/session behavior and trusted database grants. Google provider exchange still needs external configuration and testing.
