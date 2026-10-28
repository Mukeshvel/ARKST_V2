# `src/auth/activity-http.ts`

[Open the original file](../../../../../src/auth/activity-http.ts) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

A server-side authentication or request-boundary module for one shared Activity, assignment and completion model.

## B. Why does ARKST need it?

It supports one shared Activity, assignment and completion model. A teacher assigns NPTEL work and assigned students report external completion.

## C. How does it work?

It checks identity, cookies, origins, request shape or public error mapping before protected data is returned. Named declarations include `VerifiedIdentity`, `activityRequest`, `identity`, `failure`, `readActivityJson`, `reader` and others. Imported helpers called here: `ActivityError`. `activityRequest` wraps protected API handlers. Mutations require the configured same Origin; `readActivityJson` accepts JSON only and stops at 64 KiB. It maps known authorization/validation failures to explicit HTTP responses.

## D. Which files does it connect to?

- [`src/auth/identity.ts`](../../../../../src/auth/identity.ts) — a real imported or workflow-related file.
- [`src/auth/server.ts`](../../../../../src/auth/server.ts) — a real imported or workflow-related file.
- [`src/auth/http.ts`](../../../../../src/auth/http.ts) — a real imported or workflow-related file.
- [`src/auth/errors.ts`](../../../../../src/auth/errors.ts) — a real imported or workflow-related file.
- [`src/core/activity-input.ts`](../../../../../src/core/activity-input.ts) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The connected modules listed below may need review and focused regression checks.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- activity` against the existing isolated local stack if this workflow changed.

## G. Important cautions

A valid sign-in is not permission to view other students. Keep the active-profile check, exact origin/session behavior and trusted database grants. Google provider exchange still needs external configuration and testing.
