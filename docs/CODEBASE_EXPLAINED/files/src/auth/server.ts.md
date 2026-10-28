# `src/auth/server.ts`

[Open the original file](../../../../../src/auth/server.ts) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

A server-side authentication or request-boundary module for real sign-in, session checks and account authorization.

## B. Why does ARKST need it?

It supports real sign-in, session checks and account authorization. A signed-in teacher must still have an active approved profile and exact capability to assign students.

## C. How does it work?

It checks identity, cookies, origins, request shape or public error mapping before protected data is returned. Named declarations include `CookieOptionsWithName`, `AUTH_COOKIE`, `identityConfig`, `config`, `sessionOptions`, `createIdentityClient` and others. The Supabase SSR client reads and writes `arkst-session` cookies with HttpOnly, SameSite=Lax and HTTPS-only Secure behavior. Read-only rendering cannot silently write refreshed cookies; the proxy handles refresh. `clearApplicationSession` removes chunked and verifier cookies after logout or failed OAuth.

## D. Which files does it connect to?

- [`src/config/identity.ts`](../../../../../src/config/identity.ts) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The connected modules listed below may need review and focused regression checks.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- identity` against the existing isolated local stack if this workflow changed.

## G. Important cautions

A valid sign-in is not permission to view other students. Keep the active-profile check, exact origin/session behavior and trusted database grants. Google provider exchange still needs external configuration and testing.
