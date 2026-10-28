# `src/app/api/push/subscription/route.ts`

[Open the original file](../../../../../../../../src/app/api/push/subscription/route.ts) · [Back to file index](../../../../../../FILE_INDEX.md)

## A. What is this file?

The `POST, PUT, DELETE` handler for `/api/push/subscription`.

## B. Why does ARKST need it?

It supports desktop push subscription and delivery. A newly assigned student gets an inbox entry; an opted-in browser may also receive a dispatched desktop push.

## C. How does it work?

It receives a browser request, validates or delegates it, and returns a response for desktop push subscription and delivery. It delegates data work to imported data or validation helpers. HTTP methods: POST, PUT, DELETE. Named declarations include `dynamic`, `POST`, `PUT`, `DELETE`. Imported helpers called here: `activityRequest`, `readActivityJson`, `pushEndpointInput`, `pushSubscriptionInput`, `disablePushSubscription`, `registerPushSubscription`.

## D. Which files does it connect to?

- [`src/auth/activity-http.ts`](../../../../../../../../src/auth/activity-http.ts) — a real imported or workflow-related file.
- [`src/core/push-input.ts`](../../../../../../../../src/core/push-input.ts) — a real imported or workflow-related file.
- [`src/data/push.ts`](../../../../../../../../src/data/push.ts) — a real imported or workflow-related file.

## E. What happens if I modify this file?

Callers of this endpoint, input validation and the downstream SQL policy may all be affected. Recheck success and denied roles.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- push` against the existing isolated local stack if this workflow changed.

## G. Important cautions

Never log subscription secrets or VAPID private keys. An accepted push-provider request does not prove a Windows popup; check recipient ownership and account switching.
