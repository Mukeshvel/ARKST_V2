# `scripts/lib/push-dispatch.mjs`

[Open the original file](../../../../../scripts/lib/push-dispatch.mjs) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

A command-line operation for desktop push subscription and delivery.

## B. Why does ARKST need it?

It supports desktop push subscription and delivery. A newly assigned student gets an inbox entry; an opted-in browser may also receive a dispatched desktop push.

## C. How does it work?

It runs outside the browser using its own process environment and invokes the modules, SQL or Supabase calls named in the file. Named declarations include `LEASE_SECONDS`, `MAX_DELIVERY_ATTEMPTS`, `MAX_DEVICES_PER_PASS`, `MAX_JOBS_PER_RUN`, `allowedPushEndpoint`, `url` and others. A bounded dispatcher claims durable outbox jobs, sends only to validated stored subscription endpoints, records provider attempts and retries temporary failures. A crash between provider acceptance and database recording can still cause a duplicate notification.

## D. Which files does it connect to?

- [`package.json`](../../../../../package.json) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The connected modules listed below may need review and focused regression checks.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- push` against the existing isolated local stack if this workflow changed.

## G. Important cautions

Never log subscription secrets or VAPID private keys. An accepted push-provider request does not prove a Windows popup; check recipient ownership and account switching.
