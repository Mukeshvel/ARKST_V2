# `src/proxy.ts`

[Open the original file](../../../../src/proxy.ts) · [Back to file index](../../FILE_INDEX.md)

## A. What is this file?

An application source file for the ARKST application or its development workflow.

## B. Why does ARKST need it?

A returning signed-in student needs refreshed cookies and private response headers.

## C. How does it work?

It supplies the exported behavior or styling used by the app. Named declarations include `NextRequest`, `proxy`, `settings`, `client`, `previous`, `cookie` and others. Next.js Proxy refreshes Supabase session cookies and sets private cache behavior. The protected API and SQL policies still perform their own checks; the proxy is not the final permission decision.

## D. Which files does it connect to?

- [`src/config/identity.ts`](../../../../src/config/identity.ts) — a real imported or workflow-related file.
- [`src/auth/http.ts`](../../../../src/auth/http.ts) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The connected modules listed below may need review and focused regression checks.

## F. How do I verify a safe change?

Run `npm run check`; if the file affects database-backed behavior, also run the relevant `npm run test:local` suite.

## G. Important cautions

A valid sign-in is not permission to view other students. Keep the active-profile check, exact origin/session behavior and trusted database grants. Google provider exchange still needs external configuration and testing.
