# `public/arkst-push-sw.js`

[Open the original file](../../../../public/arkst-push-sw.js) · [Back to file index](../../FILE_INDEX.md)

## A. What is this file?

The browser service worker for Web Push.

## B. Why does ARKST need it?

It supports desktop push subscription and delivery. A newly assigned student gets an inbox entry; an opted-in browser may also receive a dispatched desktop push.

## C. How does it work?

It receives push events, validates notification targets and handles notification clicks outside the React page. Named declarations include `notificationIdPattern`, `response`, `windows`, `window`, `path`, `target` and others. API paths named here: `/api/push/config`, `/api/push/subscription`. The service worker handles incoming push payloads and notification clicks even when the React tab is absent. It validates same-origin navigation targets and uses browser notification APIs; actual Windows delivery depends on browser permission and a running trusted dispatcher.

## D. Which files does it connect to?

- No direct project-file import is present; follow the configured tool or route that reads this file.

## E. What happens if I modify this file?

The connected modules listed below may need review and focused regression checks.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- push` against the existing isolated local stack if this workflow changed.

## G. Important cautions

Never log subscription secrets or VAPID private keys. An accepted push-provider request does not prove a Windows popup; check recipient ownership and account switching.
