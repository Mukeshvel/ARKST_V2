# Decisions

## Accepted foundation choices

- One Next.js App Router application, strict TypeScript, React and plain CSS. No UI
  framework, custom font network dependency, microservices or speculative service layer.
- Node 24 LTS, pinned direct dependencies and npm lockfile.
- ESLint 10 with the official Next plugin and TypeScript rules; Prettier conventions.
  Next's bundled lint preset was replaced during Milestone 1 because its then-resolved
  React/import/accessibility plugins rejected ESLint 10 while npm marked ESLint 9
  unsupported. TypeScript 5.9.3 stays within the parser's compatibility range. Add
  supported React hooks/accessibility rules before richer interactive UI work.
- Vitest for pure rules/configuration/request-validation tests; separate integration
  tests for real identity and database behavior. No paid test API or substitute Auth.
- Shared activity/occurrence/assignment model; no independent per-category databases.
- No commits, pushes, remote database changes, provisioning or deployment in this work.

## Milestone 2 identity choices

- Add real Supabase Auth/PostgreSQL integration code without pretending local services
  exist. Docker, Supabase CLI and PostgreSQL tools are unavailable; system-level installs
  require approval. SQL and genuine login/RLS tests remain unverified until prerequisites
  are available. Do not replace them with fake successful tests or simulated sessions.
- Separate authentication from provisioning. No signup endpoint or automatic profile/role
  trigger. Local Supabase signup/anonymous sign-in are disabled. Trusted operators create
  approved profiles/responsibilities out of band; app admins have no write bypass.
- Authorize by verified Auth UUID and fresh database records. Provider metadata, email
  patterns, client role choices and arbitrary user IDs never confer authority. Google
  OAuth can later use the same profile/role model, but is neither enabled nor tested.
- Limit this milestone to own active profile/current responsibilities. Staff classification
  grants nothing. Scope links grant no inherited access or access to other people's data.
- Password login is enabled only with explicit `APP_ENV=local` and loopback application
  and Supabase origins. Hosted interactive login/onboarding is disabled. Bind local
  development servers to loopback; the configuration guard is not a firewall.
- Use server-only Supabase SSR cookie clients. HttpOnly/SameSite=Lax cookies, Secure on
  HTTPS, no-store requests/responses, exact Origin checks and bounded login forms are
  implemented. Proxy handles refresh; protected entry points independently use verified
  claims and a current `getUser` lookup. No service-role key enters application requests.
- RLS returns no profile for either inactive or unprovisioned users. Use one accurate
  generic denial rather than reveal hidden account state or bypass RLS for diagnostics.
- API failures have explicit 401/403/503 statuses. The protected HTML page may render an
  error with HTTP 200; it must not reveal profile data. Automated status consumers use
  the API. No business operation reports success without an upstream success result.
- Logout requests local-session refresh-token revocation and clears browser cookies.
  Copied access JWTs can remain valid until expiry (local: 900 seconds); immediate replay
  revocation is not implemented. A failed logout clears the local session but visibly
  reports that remote revocation was not confirmed.

## Dependency purpose and stability

Existing Next/React, TypeScript declarations, ESLint, Prettier and Vitest provide the
application build, static checks, formatting and unit runner. Exact versions and actual
verification results are maintained in PROJECT_STATUS.

| Milestone 2 dependency  | Pinned version | Purpose                                                                                                                                                  |
| ----------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@supabase/supabase-js` | 2.118.0        | Actual Auth and session-scoped PostgreSQL Data API requests.                                                                                             |
| `@supabase/ssr`         | 0.12.7         | Supabase session cookie/refresh integration. Supabase documents this package as beta with a potentially unstable API; pinning does not remove that risk. |
| `server-only`           | 0.0.1          | Prevent server auth/data modules from entering client imports.                                                                                           |
| `pg` (development only) | 8.23.1         | Isolated integration test setup/failure checks against real local PostgreSQL; not an application database client.                                        |

No new paid service is required. Runtime setup uses a publishable/anon key; local
administrative test credentials are supplied only to the guarded integration process.
Review SSR upgrades and rerun genuine refresh/login/logout tests before adopting them.

Guidance checked: [Next installation](https://nextjs.org/docs/app/getting-started/installation),
[Next.js Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy),
[Supabase SSR setup](https://supabase.com/docs/guides/auth/server-side/creating-a-client),
[SSR beta status](https://supabase.com/docs/guides/auth/server-side),
[logout semantics](https://supabase.com/docs/reference/javascript/auth-signout),
[database testing](https://supabase.com/docs/guides/database/testing).
Registry metadata and installed package types are used to check package compatibility.

## Decisions and work still needed

1. Approve installation/setup of missing local container/database prerequisites before
   executing real tests. No production database or hosted fallback is authorized.
2. Define approved production identity provider/account provisioning policy, including
   college Google login configuration, invited users and disabled-user handling.
3. Approve future role/capability matrix and delegation limits. The current own-data
   access rules deliberately do not implement those academic privileges.
4. Decide organization hierarchy, dual student/staff status and group membership policy.
   Proposed publication-time recipient snapshots need explicit reconciliation rules.
5. Confirm deadline-exclusive boundaries, late work, holidays, makeup tests, recurrence
   editing, evidence, resubmission and changes to verification policy.
6. Decide student identifiers, retention, audit access and administrative change history.
   Assess hosting free-tier capacity, abuse controls, availability, backups and recovery
   before any deployment. No production-readiness claim is made.

Milestone 3 academic workflows are outside this work and must not start automatically.
