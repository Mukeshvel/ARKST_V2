# Architecture

Completion Sprint Session 1 adds follow-up, attention, escalation and catch-up
workflows on the same Activity assignments, trusted directory, announcements and
notification inbox/outbox. The new `/dashboard/attention` and
`/dashboard/catch-up` pages use authenticated API routes and fixed-path PostgreSQL
RPCs; no separate Activity or completion model was introduced. See
[WORKFLOWS.md](WORKFLOWS.md) for data flow, authorization and local evidence.

One modular Next.js 16 App Router application with strict TypeScript and React.
Initial scale: approximately 130 students and 50 staff; no microservices or monorepo.

## Implemented code and verification boundary

Milestone 1's public foundation page and pure completion/window rules are preserved.
Milestone 2 adds real Supabase Auth integration code, a protected own-profile page,
an own-profile API, session handling, SQL migrations and executable identity/RLS tests.
Milestone 2.1 verified these flows against local Supabase. Milestones 3A and 3B-1 add
the shared Activity API, structured department roster, trusted counselor mappings and
staff self-service. Milestone 3B-2A adds section-snapshot publication and narrow
creator/counselor monitoring over the same assignments and completions. See PROJECT_STATUS for executed regression checks,
[ACTIVITY_ENGINE](ACTIVITY_ENGINE.md) and [DEPARTMENT_DIRECTORY](DEPARTMENT_DIRECTORY.md).

- `src/app`: public status page, local login form, protected profile rendering,
  `/api/me`, Activity and staff-directory route handlers.
- `src/auth`: server-only cookie clients, verified identity lookup and safe error handling;
  pure request validation utilities support bounded forms and same-origin mutations.
- `src/data`: own-profile, responsibility, Activity and staff-directory queries using the caller's session.
- `src/config`: application-origin and identity configuration validation.
- `src/proxy.ts`: Next.js 16 session refresh and private response cache headers.
- `src/core`: framework-free completion accounting and configurable window rules.
- `supabase`: applied local identity, Activity and directory migrations, local config and pgTAP security tests.
- `tests/integration` and `scripts/test-local-identity.mjs`: genuine local Auth/HTTP/REST
  tests that require an explicitly isolated local stack; no substitute login is provided.

Dependency direction remains UI/server entry points → auth/data → pure core where
needed. Core does not import React, Next or Supabase. There is no browser Supabase
client and no application service-role client.

## Identity request flow implemented in code

1. Local password login is available only when `APP_ENV=local` and both `APP_ORIGIN`
   and `SUPABASE_URL` are loopback origins. POST requests must have the exact configured
   Origin and cannot declare a cross-site fetch. Login accepts only a bounded
   URL-encoded email/password form; no user ID, role or privilege field is accepted.
2. The server calls Supabase `signInWithPassword`; only an actual returned user/session
   yields the redirect to `/profile`. No signup or automatic profile creation exists.
3. Supabase SSR persists the session in `arkst-session` cookies, including SDK chunking.
   Cookies use HttpOnly, SameSite=Lax, path `/`, and Secure for HTTPS origins. Authentication
   and database fetches use no-store and a request timeout. Credentials are not echoed.
4. Proxy calls `getClaims` to refresh the session and propagates cookies to the request
   and response. Proxy is not the authorization gate: protected entry points separately
   call `getClaims` and `getUser`, check a consistent Auth user ID, then query PostgreSQL.
5. `loadOwnIdentity` filters by that verified Auth ID. The migration's RLS separately
   permits only the active owner's profile and current responsibilities. Missing/inactive
   profiles produce the same denial, without leaking a hidden account's state.
6. `/api/me` returns 401 for missing/invalid authentication, 403 for unavailable account
   authorization, and 503 for configuration/upstream failures. Protected HTML redirects
   anonymous users to login and displays accurate errors otherwise. An error page can
   carry HTTP 200; clients needing machine-readable status must use `/api/me`.
7. Logout is same-origin POST only. It calls `signOut({ scope: 'local' })`, clears the
   application's cookies, and redirects only after the SDK confirms success. If remote
   logout fails, cookies are still cleared and a visible 503 explains the unconfirmed
   revocation. Supabase access JWTs copied before logout may remain valid until expiry;
   local configuration sets 900 seconds. This is not immediate stolen-token revocation.

Private responses use `private, no-store` cache controls. No role claims from account
metadata, browser fields or email naming patterns confer authorization. Displaying
responsibilities does not grant academic capabilities. Activity capabilities require
explicit trusted provisioning tied to one responsibility and category.

## Integration boundaries and constraints

`@supabase/supabase-js` 2.118.0 and `@supabase/ssr` 0.12.7 are pinned. Supabase documents
the SSR package as beta; upgrades need review and session regression tests. `server-only`
guards auth/data imports. The ordinary application uses only the publishable/anon key
with the user's session. Administrative test credentials are confined to the explicit
local integration process and are never application/browser configuration.

Application authorization keys off Supabase Auth UUIDs and trusted database records,
so a future provider can reuse the same profile/role model. Google OAuth, hosted login,
and hosted onboarding are not enabled or tested. Supabase local signup is disabled.
No remote database has been connected, migrated, deployed or provisioned.

Before hosting: repeat authentication/RLS tests in an approved environment, verify refresh and logout in a
browser, configure approved onboarding/provider policy, and assess abuse controls,
retention, backup/recovery and operational monitoring. Follow [LOCAL_SUPABASE](LOCAL_SUPABASE.md)
for the installed isolated setup.

## Milestone 3A Activity flow

Activity routes use the existing identity check, server cookie client and private response
headers. Mutations require the exact Origin, bounded JSON and strict field validation.
The data module invokes three transactional RPCs using the caller's JWT: create, submit,
verify. The app never uses a database owner or service-role key.

RPCs explicitly authorize the caller using current active profiles and provisioned
capabilities. Creation validates all exact-scope student memberships before writing
activities, assignments and history in one transaction. Submission and verification lock
the assignment row and commit the completion and actor event together. PostgreSQL
constraints enforce uniqueness, valid timestamps and completion shape. Direct client
table mutations are revoked, including history edits. Read RLS filters activities,
assignments, completion and history independently, including nested REST requests.

Privileged functions pin an empty search path, qualify relations and derive the actor
from auth.uid(). Private helpers are in a schema not exposed by PostgREST. Only the
intentional mutation and monitoring RPCs are exposed; anonymous execution is revoked. Membership
and capability tables have no ordinary-client grants or management routes.

## Milestone 3B-2A section Activity flow

The section publication RPC validates each selected section under the approved
department, checks the caller's current CREATE capability for each, then selects
eligible active, linked roster students with current section membership in PostgreSQL.
It records one Activity, its selected-section metadata, existing per-student assignments
and history atomically. Student reporting and verification use the existing functions
and completion table. The creator monitor checks current creator/section authority;
the counselor monitor checks trusted current mappings and active students independent
of who created the Activity. Both return bounded pages. The client never receives a
service-role key or arbitrary roster query facility.

## Milestone 3B-2B operational dashboards

Protected `/dashboard/student`, `/dashboard/faculty` and `/dashboard/counselor`
pages verify the existing session and active profile on the server. Faculty staff can
open both operational views when they also have a current counselor responsibility;
navigation is a convenience, not a permission grant. Client components fetch only
the existing cookie-authenticated APIs and show server errors. The student view reads
RLS-filtered assignments and history, submits through the existing completion RPC,
then reloads the persisted Activity. Faculty creation uses the section publication
RPC and a narrow `activity_creation_options` RPC; that read-only function exposes
only currently CREATE-authorized category/section combinations and aggregate eligible
counts. Publication checks authorization and recipients again. Creator and counselor
results use the 3B-2A monitoring functions and bounded pages. No service key reaches
browser code.

`GET /api/activities/created` and `GET /api/activities/{id}/summary` are lightweight
RLS-filtered reads for the faculty view. The counselor roster endpoint now returns
50 rows per page and a real RLS-filtered count. A real headless Edge integration
flow signs in through Supabase Auth, publishes, reports completion, reloads, and
checks the creator and counselor views. See PROJECT_STATUS for executed results.

## Milestone 4 operational flow

`eligible_activity_students` exposes a bounded name/roll picker only where the
current caller has exact section CREATE authority. `create_selected_activity`
checks every selected active linked roster student and current membership; a
counseling-only request additionally checks current administrator-created
mapping. It writes the existing Activity, section snapshot, per-student
assignments and actor history. Section-wide publication and the original direct
target RPC remain available. All Activity categories share the same engine.

Creator monitoring retains its full-set counts and 50-row result pages.
Counselor summary/detail RPCs aggregate all currently mapped active students
for each Activity, even when another staff member created it. A separate
scoped `pending_students_text` RPC builds the complete authorized pending list
in the database for the clipboard action; it never uses only the visible page.
Progress bars calculate percentages from these complete counts.

Announcements have their own message, section/recipient snapshot and
creator/timestamp fields. They do not create Activity obligations. Publication
requires the existing explicit `general` CREATE capability for every target
section, with a current mapping check for counseling mode. Assignment and
announcement-recipient insert triggers write one notification per source and
recipient, followed by one outbox event, in the publication transaction.
Unique keys make repeated event processing idempotent. Student inbox SELECT
is protected by recipient RLS; read state changes through a caller-checked RPC.
At Milestone 4, the browser refreshed inbox data on focus/visibility and the
outbox had no worker. Milestone 5 adds bounded polling and a trusted dispatcher.

## Milestone 5 notification delivery

The existing inbox/outbox remains the central publication path. Forward-only
migrations add private per-user browser subscriptions, per-device attempts,
outbox due time, expiration and a recoverable claim lease. The same authenticated
server session and RLS protect inbox reads. Push subscription mutations use
same-origin APIs and fixed-path SECURITY DEFINER functions deriving `auth.uid()`;
ordinary users cannot read subscription keys, claim jobs, or edit delivery
records. The Node dispatcher uses a separate server-only database connection,
never a browser/service-role bundle. It validates provider hosts before Web
Push. Its service worker fetches an own-inbox preview through RLS before
display, so a logout/account switch fails closed. Only generic lock-screen
content and a protected same-origin destination are shown.

Inbox polling is 20 seconds and navigation unread polling is 30 seconds while
visible, with focus/reconnect reconciliation. The local dispatcher can run
continuously at a 15-second interval. Hosted scheduling and real provider
acceptance remain unverified deployment boundaries. See [NOTIFICATIONS.md](NOTIFICATIONS.md)
for lease/retry semantics, local commands, limits and actual browser evidence.

## Session 2 group, calendar and supervisory models

`academic_groups` gives `scopes(kind='group')` a direct department owner and
free-text purpose. Effective-dated `student_scope_memberships` and actor/time
history store current and past membership. Group publication takes a transactionally
locked current-member snapshot, rechecks each target against the existing category
CREATE scope, then calls the existing selected Activity/announcement RPCs. The
durable assignment or announcement recipient rows never depend on later membership
edits. Group provenance is stored separately from the shared completion model.

`recurring_schedules`, sections and slots hold the configurable academic pattern;
`academic_blackouts` hold explicit interruption windows. The authenticated runner
uses the existing section Activity publisher, while `recurring_instances` uniquely
records published, blocked, skipped or requeued occurrence keys. Blocked instances
create no Activity and therefore no notification/outbox row. An added blackout
never mutates an already-published Activity; the calendar reports that conflict.
The anchor Monday is the first cycle. Local calendar times are interpreted in the
schedule's IANA timezone and converted to stored UTC instants. An authorized
creator may separately change a manual Activity deadline/end time with an audit
row. No automatic production runner is active.

`supervisory_overview` aggregates the existing assignments, completions, follow-ups
and escalations for active students in a separately granted department. It does not
own a second progress database. Its section and counselor counts derive from
current trusted roster and mapping relationships. Group, calendar and supervision
operation grants are independent of each other and of CREATE/READ/VERIFY.

Activity cancellation, retroactive group reconciliation, hosted push/calendar
scheduling and production roster onboarding remain future operational work.

References: [Supabase Next.js SSR guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client),
[SSR stability status](https://supabase.com/docs/guides/auth/server-side),
[Supabase logout semantics](https://supabase.com/docs/reference/javascript/auth-signout),
[Next.js 16 Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy).
