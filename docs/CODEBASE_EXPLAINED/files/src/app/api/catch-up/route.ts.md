# `src/app/api/catch-up/route.ts`

[Open the original file](../../../../../../../src/app/api/catch-up/route.ts) · [Back to file index](../../../../../FILE_INDEX.md)

## A. What is this file?

The `GET, POST` handler for `/api/catch-up`.

## B. Why does ARKST need it?

It supports student missed-information requests and official publication. A student asks for missed class information; approved staff publish their own official response.

## C. How does it work?

It receives a browser request, validates or delegates it, and returns a response for student missed-information requests and official publication. It delegates data work to imported data or validation helpers. HTTP methods: GET, POST. Named declarations include `dynamic`, `GET`, `POST`. Imported helpers called here: `activityRequest`, `readActivityJson`, `catchUpRequestInput`, `notificationOffset`, `listCatchUpRequests`, `submitCatchUpRequest`.

## D. Which files does it connect to?

- [`src/auth/activity-http.ts`](../../../../../../../src/auth/activity-http.ts) — a real imported or workflow-related file.
- [`src/core/activity-input.ts`](../../../../../../../src/core/activity-input.ts) — a real imported or workflow-related file.
- [`src/data/activities.ts`](../../../../../../../src/data/activities.ts) — a real imported or workflow-related file.

## E. What happens if I modify this file?

Callers of this endpoint, input validation and the downstream SQL policy may all be affected. Recheck success and denied roles.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- workflows` against the existing isolated local stack if this workflow changed.

## G. Important cautions

Keep same-origin mutation checks, bounded input and caller-session RLS. A UI filter is not an authorization boundary.
