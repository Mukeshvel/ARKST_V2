# `scripts/test-local-push.mjs`

[Open the original file](../../../../scripts/test-local-push.mjs) · [Back to file index](../../FILE_INDEX.md)

## A. What is this file?

A regression test for desktop push subscription and delivery.

## B. Why does ARKST need it?

It supports desktop push subscription and delivery. A newly assigned student gets an inbox entry; an opted-in browser may also receive a dispatched desktop push.

## C. How does it work?

It checks concrete behaviors such as six real assigned students receive exact durable inbox and outbox records; subscription APIs bind devices to real users and deny cross-account reads and writes. Inspect the test setup to distinguish real local Auth/PostgreSQL/HTTP from pure in-process checks. Named declarations include `main`, `config`, `tag`, `department`, `db`, `users` and others. Examples of checks: six real assigned students receive exact durable inbox and outbox records; subscription APIs bind devices to real users and deny cross-account reads and writes; authenticated registration is limited to ten active devices per account. API paths named here: `/api/announcements`, `/api/activities/selected`, `/api/notifications`, `/api/notifications/unread`.

## D. Which files does it connect to?

- [`tests/integration/local-helpers.mjs`](../../../../tests/integration/local-helpers.mjs) — a real imported or workflow-related file.
- [`scripts/lib/push-dispatch.mjs`](../../../../scripts/lib/push-dispatch.mjs) — a real imported or workflow-related file.
- [`package.json`](../../../../package.json) — a real imported or workflow-related file.

## E. What happens if I modify this file?

You change what regressions are detected, not the production feature itself. Keep the assertions tied to real rules.

## F. How do I verify a safe change?

Run `npm run test:local -- push` through the existing local wrapper with the isolated Supabase stack; review fixture cleanup.

## G. Important cautions

Do not weaken assertions to make a regression pass. Local synthetic accounts and controlled provider responses are not proof of hosted or desktop delivery.
