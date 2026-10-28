# `src/app/dashboard/notifications/page.tsx`

[Open the original file](../../../../../../../src/app/dashboard/notifications/page.tsx) · [Back to file index](../../../../../FILE_INDEX.md)

## A. What is this file?

The server page for `/dashboard/notifications`.

## B. Why does ARKST need it?

It supports the recipient inbox, unread state and delivery outbox. A newly assigned student gets an inbox entry; an opted-in browser may also receive a dispatched desktop push.

## C. How does it work?

It loads or prepares the authorized dashboard view for the recipient inbox, unread state and delivery outbox, then renders the connected components. Named declarations include `dynamic`, `NotificationsPage`.

## D. Which files does it connect to?

- [`src/app/dashboard/dashboard-nav.tsx`](../../../../../../../src/app/dashboard/dashboard-nav.tsx) — a real imported or workflow-related file.
- [`src/app/dashboard/identity.tsx`](../../../../../../../src/app/dashboard/identity.tsx) — a real imported or workflow-related file.
- [`src/app/dashboard/notifications/notification-inbox.tsx`](../../../../../../../src/app/dashboard/notifications/notification-inbox.tsx) — a real imported or workflow-related file.
- [`src/app/dashboard/notifications/push-control.tsx`](../../../../../../../src/app/dashboard/notifications/push-control.tsx) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The corresponding student or staff screen may change, including its API calls and error states. Confirm both desktop and narrow screens.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- push` against the existing isolated local stack if this workflow changed.

## G. Important cautions

Never log subscription secrets or VAPID private keys. An accepted push-provider request does not prove a Windows popup; check recipient ownership and account switching.
