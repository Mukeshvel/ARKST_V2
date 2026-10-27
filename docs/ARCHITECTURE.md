# Architecture

One modular Next.js 16 App Router application with strict TypeScript and React.
Initial scale: approximately 130 students and 50 staff; no microservices or monorepo.

## Implemented code and verification boundary

Milestone 1's public foundation page and pure completion/window rules are preserved.
Milestone 2 adds real Supabase Auth integration code, a protected own-profile page,
an own-profile API, session handling, SQL migrations and executable identity/RLS tests.
Milestone 2.1 verified these flows against local Supabase. Milestones 3A and 3B-1 add
the shared Activity API, structured department roster, trusted counselor mappings and
staff self-service. See PROJECT_STATUS for executed regression checks,
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
from auth.uid(). Four helpers are in a schema not exposed by PostgREST. Only the three
intentional mutation RPCs are exposed; anonymous execution is revoked. Membership
and capability tables have no ordinary-client grants or management routes.

## Future academic workflows — not implemented

Groups/dynamic membership, recurrence generation, activity editing/cancellation,
announcements, notifications, counselor follow-up and catch-up remain future work.
They can reference the same Activity and assignment IDs. Group targeting is rejected,
not expanded into simulated recipients. No teacher/student dashboard is implemented.

References: [Supabase Next.js SSR guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client),
[SSR stability status](https://supabase.com/docs/guides/auth/server-side),
[Supabase logout semantics](https://supabase.com/docs/reference/javascript/auth-signout),
[Next.js 16 Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy).
