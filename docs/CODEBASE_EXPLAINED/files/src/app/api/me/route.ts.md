# `src/app/api/me/route.ts`

[Open the original file](../../../../../../../src/app/api/me/route.ts) · [Back to file index](../../../../../FILE_INDEX.md)

## A. What is this file?

The `GET` handler for `/api/me`.

## B. Why does ARKST need it?

The browser can request only the current authenticated profile and responsibilities.

## C. How does it work?

It receives a browser request, validates or delegates it, and returns a response for the ARKST application or its development workflow. It delegates data work to imported data or validation helpers. HTTP methods: GET. Named declarations include `dynamic`, `GET`, `failure`. Imported helpers called here: `requireOwnIdentity`, `publicIdentityError`.

## D. Which files does it connect to?

- [`src/auth/identity.ts`](../../../../../../../src/auth/identity.ts) — a real imported or workflow-related file.
- [`src/auth/errors.ts`](../../../../../../../src/auth/errors.ts) — a real imported or workflow-related file.
- [`src/auth/http.ts`](../../../../../../../src/auth/http.ts) — a real imported or workflow-related file.
- [`src/auth/activity-http.ts`](../../../../../../../src/auth/activity-http.ts) — a real imported or workflow-related file.

## E. What happens if I modify this file?

Callers of this endpoint, input validation and the downstream SQL policy may all be affected. Recheck success and denied roles.

## F. How do I verify a safe change?

Run `npm run check`; if the file affects database-backed behavior, also run the relevant `npm run test:local` suite.

## G. Important cautions

Keep same-origin mutation checks, bounded input and caller-session RLS. A UI filter is not an authorization boundary.
