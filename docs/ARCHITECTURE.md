# Architecture

One modular Next.js 16 App Router application with strict TypeScript and React.
Initial scale: approximately 130 students and 50 staff; no microservices or monorepo.

## Implemented code and verification boundary

Milestone 1's public foundation page and pure completion/window rules are preserved.
Milestone 2 adds real Supabase Auth integration code, a protected own-profile page,
an own-profile API, session handling, SQL migrations and executable identity/RLS tests.
The SQL and successful authentication flows have **not been executed locally** because
Docker, Supabase CLI and PostgreSQL tools are unavailable. Implemented code is not
evidence of a working database connection. See PROJECT_STATUS for executed checks.

- `src/app`: public status page, local login form, protected profile rendering and
  `/auth/login`, `/auth/logout`, `/api/me` route handlers.
- `src/auth`: server-only cookie clients, verified identity lookup and safe error handling;
  pure request validation utilities support bounded forms and same-origin mutations.
- `src/data`: own-profile and responsibility queries using the caller's session.
- `src/config`: application-origin and identity configuration validation.
- `src/proxy.ts`: Next.js 16 session refresh and private response cache headers.
- `src/core`: framework-free completion accounting and configurable window rules.
- `supabase`: unapplied identity migration, isolated local config and pgTAP policy tests.
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
responsibilities does not grant academic capabilities in this milestone.

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

Before hosting: execute real authentication/RLS tests, verify refresh and logout in a
browser, configure approved onboarding/provider policy, and assess abuse controls,
retention, backup/recovery and operational monitoring. Follow [LOCAL_SUPABASE](LOCAL_SUPABASE.md)
for the isolated setup after system prerequisites are approved and installed.

## Future academic workflows — not implemented

Each future mutation must validate payloads and transitions, authorize every target,
and enforce matching RLS. Persist writes and audit events atomically; use unique
assignment keys and concurrency controls. Return success only after a confirmed
commit and refresh only the affected user-scoped views. General workflow authorization,
audit trails, groups/memberships, activity creation, scheduling generation, announcements,
follow-up, notifications and catch-up remain future work.

References: [Supabase Next.js SSR guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client),
[SSR stability status](https://supabase.com/docs/guides/auth/server-side),
[Supabase logout semantics](https://supabase.com/docs/reference/javascript/auth-signout),
[Next.js 16 Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy).
