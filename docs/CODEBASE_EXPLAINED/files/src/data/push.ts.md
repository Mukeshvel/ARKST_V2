# `src/data/push.ts`

[Open the original file](../../../../../src/data/push.ts) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

A server-only data access module for desktop push subscription and delivery.

## B. Why does ARKST need it?

It supports desktop push subscription and delivery. A newly assigned student gets an inbox entry; an opted-in browser may also receive a dispatched desktop push.

## C. How does it work?

It uses the authenticated Supabase client to query RLS-protected tables or call named SQL functions; the browser never receives an owner database key. Named declarations include `pushResult`, `registerPushSubscription`, `pushSubscriptionStatus`, `disablePushSubscription`, `markNotificationUnread`. Supabase RPCs named here: `register_push_subscription`, `push_subscription_status`, `disable_push_subscription`, `mark_notification_unread`. Imported helpers called here: `ActivityError`.

## D. Which files does it connect to?

- [`src/core/activity-input.ts`](../../../../../src/core/activity-input.ts) — a real imported or workflow-related file.
- [`src/core/push-input.ts`](../../../../../src/core/push-input.ts) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The connected modules listed below may need review and focused regression checks.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- push` against the existing isolated local stack if this workflow changed.

## G. Important cautions

Never log subscription secrets or VAPID private keys. An accepted push-provider request does not prove a Windows popup; check recipient ownership and account switching.
