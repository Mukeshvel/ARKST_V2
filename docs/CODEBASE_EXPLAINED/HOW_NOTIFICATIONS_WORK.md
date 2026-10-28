# How notifications work

ARKST has two related layers: a durable **in-app inbox** and optional **desktop Web
Push**. An in-app notification can exist even when a browser has never opted in to
desktop notifications.

## From publication to inbox

When staff publish an Activity or announcement, SQL creates exact recipient rows
and notification/outbox records in the same transaction. An announcement carries
information but creates no Activity completion obligation. A student opens
[the inbox screen](../../src/app/dashboard/notifications/notification-inbox.tsx),
which calls the authenticated [notifications API](../../src/app/api/notifications/route.ts).
Read/unread actions apply only to that user's notification. Recipient ownership and
RLS prevent another student from reading it.

Example: six students are selected for NPTEL. Only those six get assignment and
inbox rows. If the outbox insert fails, the Activity publication rolls back; the
UI must show failure rather than “sent.”

## Desktop delivery adds more steps

The browser [push control](../../src/app/dashboard/notifications/push-control.tsx)
asks permission and registers [the service worker](../../public/arkst-push-sw.js).
It sends the genuine browser subscription through
[the subscription API](../../src/app/api/push/subscription/route.ts); SQL binds it
to the signed-in user. The trusted [dispatcher](../../scripts/lib/push-dispatch.mjs)
later claims due outbox jobs, validates stored provider endpoints, attempts Web Push,
records the provider result and retries temporary failures. The
[hosted entry point](../../scripts/dispatch-notifications.mjs) needs a protected
database connection, VAPID private key and monitored schedule. The Next.js web
process must not receive those secrets.

A provider HTTP 201 means the provider accepted the request. It does not prove that
Chrome received it, Windows displayed it, or a click opened the correct Activity.
Milestone 5.1 observed those final steps once in normal local Chrome after fixing
the service-worker click handler. Headless browser push registration may fail by
browser policy; hosted/tab-closed/account-switch cases still need real verification.

## Reliability and privacy

Jobs persist in PostgreSQL across process restarts. Claims and leases prevent two
normal workers from owning the same job, and transient failures can retry. A crash
after provider acceptance but before the database saves that result can produce a
duplicate notification on retry; do not promise exactly-once desktop delivery.
The service worker validates navigation targets and the API checks user ownership.
Do not log subscription encryption secrets, full endpoints, VAPID private keys or
private notification bodies.

The relevant code is [push data access](../../src/data/push.ts),
[push SQL](../../supabase/migrations/20261028000100_push_delivery.sql),
[dispatcher](../../scripts/lib/push-dispatch.mjs) and
[worker](../../public/arkst-push-sw.js). Focused checks are `npm run test:local -- push`,
`npm run test:rls` and the Node worker tests in `npm test`. Real hosted/Windows
delivery must be observed separately.
