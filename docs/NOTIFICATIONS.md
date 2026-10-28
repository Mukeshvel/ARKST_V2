# Notifications and Web Push — Milestones 5 and 5.1

## Data flow and delivery guarantees

An authorized Activity or announcement publication uses the existing target and
scope rules. Assignment/recipient triggers insert one `notifications` row and one
`notification_outbox` row per exact recipient in that same PostgreSQL transaction.
The inbox row is permanent source data; a push response is only an optional
delivery attempt. The user can read missed notices after reopening ARKST.

`push_subscriptions` stores a browser endpoint and encryption keys for one
authenticated active account. The ordinary API permits at most ten active
devices per account. It never returns stored endpoint/key lists. A shared
endpoint cannot be registered to another account. The user's browser can
enable or disable its own subscription, with an explicit gesture for the
permission prompt. Subscriptions are not inferred from a profile designation,
student ID supplied by a browser, or a published audience selection.

A trusted Node 24 dispatcher connects with a **server-only database URL**. It
claims at most 20 due outbox jobs per run with `FOR UPDATE SKIP LOCKED` and a
three-minute lease. For each job it snapshots currently active devices and
sends at most eight pending devices in one pass. Device results distinguish
provider acceptance, temporary failure, permanent rejection, expired device
and invalid endpoint. Temporary failures retry with exponential backoff from
30 seconds to one hour, at most six attempts, until the outbox's 24-hour
expiration. 404/410 disables the endpoint. Expired devices are disabled.
Another worker can reclaim a job after its lease expires. A crash after the
push service accepts a message but before the database records that acceptance
can cause a repeat provider request. One inbox row per source/recipient is
still guaranteed by its unique key; exactly-once visible push is **not**.
The browser uses the notification ID as a display tag to reduce duplicate
popups. A 2xx provider response means accepted by the push service, not viewed
by a human.

Only an opaque inbox ID is sent in the encrypted Web Push payload. The service
worker re-fetches a generic, privacy-preserving preview through the current
session and recipient RLS before showing a popup. A logged-out or switched
account cannot display the former account's private content. A failed preview
fetch means no popup; the inbox remains available when ARKST reconnects. Click
destinations are fixed same-origin Activity, announcement, inbox or attention paths, with their
normal server authorization. The service worker does not cache application
data or intercept normal requests. An in-flight provider attempt may finish
after a user disables the endpoint; future claims exclude inactive devices.

`notification_outbox.processed_at` now means the job has no pending device
attempts. `outcome='accepted'` means at least one device's push provider
accepted it. `no_subscriptions`, `failed`, and `expired` do not remove or mark
the user's inbox notification read. A user who opts in after a job has been
processed receives future pushes; prior inbox notices are available in ARKST.

## Open dashboard synchronization

The inbox fetches authoritative RLS-filtered data every 20 seconds while
visible and on focus, reconnection, and service-worker message. Navigation's
unread count refreshes every 30 seconds while visible and on the same wake
events. These are **polling intervals**, not instantaneous Realtime delivery.
Users can mark an own notice read or unread through authenticated RPCs. The
original focus/visibility reconciliation remains. No private Realtime
channel or global broadcast was added. Even when browser push is denied, the
in-app inbox and read state work. If the backend is unavailable, the UI shows
an error and cannot claim newly published messages were received.

## Local operation

1. Keep the existing local Supabase stack running. Apply forward migrations
   with `npx supabase migration up --local` using the project's local
   `SUPABASE_HOME` setting. Do not reset the database.
2. Run `npm run push:generate-local-keys` once. It creates ignored
   `.env.push.local` and refuses to overwrite it. Keep its private key out of
   Git, browser bundles and logs. Copy only its `PUSH_VAPID_PUBLIC_KEY` value
   into the app server's ignored `.env.local` alongside existing local identity
   settings. The keypair must remain stable while subscriptions exist.
3. Start the app with `npm run dev`. In a supported browser at a localhost or
   HTTPS origin, open Inbox and explicitly choose **Enable desktop
   notifications**. The app persists the resulting browser subscription
   against the signed-in account. Denied or unsupported browsers keep the
   inbox.
4. In another terminal, set `APP_ENV=local` and run
   `npm run push:watch:local`. This trusted local process reads only the
   isolated loopback database from `supabase status` and checks the queue about
   every 15 seconds, or one second after a full 20-job batch. Stop with Ctrl-C.
   `npm run push:dispatch:local` makes one bounded pass. The local developer
   laptop must remain on for this local process, but no production design
   assumes that.

The local test runner generates ephemeral VAPID keys in memory for isolated
synthetic accounts. It never writes them to Git. Run
`$env:APP_ENV='local'; $env:LOCAL_IDENTITY_TESTS='1'; npm run test:local -- push`
after `npm run build`. This invokes real Auth, HTTP, PostgreSQL, installed
browser and a deterministic provider sender for failure tests. A separate real
browser/provider attempt is reported independently; deterministic responses
are **not** evidence of actual desktop delivery.

## Hosted operation still requires a deployment decision

The production CLI entry point is `npm run push:dispatch` with server-only
`PUSH_DATABASE_URL`, `PUSH_VAPID_PUBLIC_KEY`, `PUSH_VAPID_PRIVATE_KEY`, and
`PUSH_VAPID_SUBJECT=mailto:...`. It is a bounded Node process, not a Next.js
request handler or persistent daemon. A future **trusted Node 24 scheduler**
must invoke it regularly, supply secrets securely, connect to the hosted
Postgres endpoint, collect sanitized job metrics, and restart failed runs.
No remote scheduler or dispatch HTTP route was created or activated. Hosted
database connectivity, run frequency, request limits and cost have not been
tested; reliable hosted background execution is a deployment blocker.

Supabase documents scheduling Edge Functions with `pg_cron`/`pg_net` and Vault,
and currently lists a Free plan Edge Function invocation quota. This Node
dispatcher is not an Edge Function, so that schedule cannot be assumed to run
it unchanged. A future port or trusted Node host requires separate compatibility
and quota review. [Scheduling documentation](https://supabase.com/docs/guides/functions/schedule-functions)
and [current invocation pricing](https://supabase.com/docs/guides/functions/pricing)
must be checked when a hosting plan is selected. Database storage, network
egress and scheduler hosting can also incur cost; perpetual free hosting is
not claimed.

The `web-push` 3.6.7 Node library is MPL-2.0, declares Node >=16, and has five
direct runtime dependencies in its [package metadata](https://github.com/web-push-libs/web-push/blob/master/package.json).
It handles VAPID and encrypted Web Push. The worker separately restricts
endpoints to known HTTPS push-provider hosts and port 443 before any network
request; the API applies the same restriction. No arbitrary URL from a user or
database row is fetched by the dispatcher.

## Local browser evidence and remaining limit

The first automated Chrome/Edge attempts used private Playwright contexts.
Even with notification and PushManager permission reported `granted`, an
activated worker, a valid 65-byte VAPID public key and user activation at
`subscribe()`, Chromium returned `AbortError: Registration failed - permission
denied`. Chromium maps incognito push denial to that public error. A separate
temporary persistent Chrome profile reached the enabled UI state, although
that diagnostic run ended before provider verification.

In Milestone 5.1, a normal Chrome profile manually enabled desktop push for
one synthetic local student. PostgreSQL held exactly one active subscription
for that student; another authenticated student saw status `false` and got
HTTP 403 when trying to register the endpoint. The existing selected-student
Activity API produced a real assignment, inbox row and one outbox job. The
trusted local dispatcher claimed that job, made one actual provider request
and stored HTTP 201/`accepted`. The authorized preview returned 200 and the
correct Activity URL; the other student got 404. No Windows notification was
observed on that first send. A read-only Windows check found global toasts
enabled but the Chrome sender explicitly disabled (`Enabled=0`). The user
then enabled Chrome notifications manually; the override disappeared. One
new synthetic Activity was sent, again with one claim, one attempt and HTTP
201/`accepted`. Windows displayed this notification in Notification Center,
but clicking it left the existing ARKST tab on the inbox. The worker click
handler was corrected to open and focus the validated same-origin target,
falling back to an existing tab only if opening fails. Three deterministic
click-handler tests cover the new path, fallback and untrusted URL rejection.

After a laptop restart, read-only local checks confirmed that the synthetic
accounts, one active recipient subscription, both earlier Activities and their
accepted delivery records survived. No migration was reapplied. The existing
build served the corrected worker at the same loopback origin. The user
manually disabled/re-enabled push, closed all ARKST tabs and reopened the inbox;
the UI again showed `Enabled on this browser`. Exactly one new synthetic
Activity was then published and dispatched: one outbox claim, one real provider
attempt, HTTP 201/`accepted`. The user observed a Windows notification and
Notification Center entry, clicked it, and saw Chrome open the correct
`Manual Web Push … click check` Activity. PostgreSQL subsequently confirmed
the assignment belonged to that student and their completion persisted as
`reported` with actor, timestamp and `created`/`assigned`/`reported` history.
This is real local desktop delivery and click evidence; provider acceptance
alone would not establish it.

The local browser verified polling, reload and reconnect reconciliation.
Worker send/retry failures were also verified against real database jobs with
controlled provider responses; those controlled responses are not real
desktop delivery evidence. Tab-closed delivery, logout/account-switch popup
suppression in a real browser, and hosted HTTPS push still require direct
verification. A trusted hosted scheduler and secret handling remain separate
deployment work.
