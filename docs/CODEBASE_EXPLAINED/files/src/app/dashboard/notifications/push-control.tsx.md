# `src/app/dashboard/notifications/push-control.tsx`

[Open the original file](../../../../../../../src/app/dashboard/notifications/push-control.tsx) · [Back to file index](../../../../../FILE_INDEX.md)

## A. What is this file?

A dashboard UI component for desktop push subscription and delivery.

## B. Why does ARKST need it?

It supports desktop push subscription and delivery. A newly assigned student gets an inbox entry; an opted-in browser may also receive a dispatched desktop push.

## C. How does it work?

It renders the labels, forms, lists or progress shown to a signed-in user and calls the named API paths or imported helpers in this file. Named declarations include `Status`, `browserSupported`, `applicationKey`, `binary`, `PushControl`, `refresh` and others. API paths named here: `/api/push/subscription`, `/api/push/config`.

## D. Which files does it connect to?

- [`src/app/dashboard/dashboard-data.ts`](../../../../../../../src/app/dashboard/dashboard-data.ts) — a real imported or workflow-related file.
- [`src/app/dashboard/dashboard-nav.tsx`](../../../../../../../src/app/dashboard/dashboard-nav.tsx) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The corresponding student or staff screen may change, including its API calls and error states. Confirm both desktop and narrow screens.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- push` against the existing isolated local stack if this workflow changed.

## G. Important cautions

Never log subscription secrets or VAPID private keys. An accepted push-provider request does not prove a Windows popup; check recipient ownership and account switching.
