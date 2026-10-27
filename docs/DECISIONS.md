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

- Supabase Auth/PostgreSQL integration was verified locally in Milestone 2.1 after
  Docker became available. Milestone 3A preserves it and reruns its SQL and genuine
  login/RLS tests. No simulated sessions or mock database substitutes are used.
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

1. Keep verification on the approved isolated local Supabase stack. No production
   database or hosted fallback is authorized.
2. Define approved production identity provider/account provisioning policy, including
   college Google login configuration, invited users and disabled-user handling.
3. Approve future role/capability matrix and delegation limits. The current own-data
   rules grant no academic authority based on role names. Milestone 3A supports explicit
   capability rows, with no standing grants created by the migration.
4. Decide organization hierarchy, dual student/staff status and group membership policy.
   Proposed publication-time recipient snapshots need explicit reconciliation rules.
5. Confirm deadline-exclusive boundaries, late work, holidays, makeup tests, recurrence
   editing, evidence, resubmission and changes to verification policy.
6. Decide student identifiers, retention, audit access and administrative change history.
   Assess hosting free-tier capacity, abuse controls, availability, backups and recovery
   before any deployment. No production-readiness claim is made.

Milestone 3A implements direct activities only. Milestone 3B must not start automatically.

## Milestone 3A decisions

- Preserve the modular Next.js/Supabase architecture and identity tables. Add one forward
  migration; use session-scoped RPCs rather than service-role writes from the application.
- Use explicit capability provisioning because the documented role matrix is provisional.
  No teacher, counselor, HOD or admin gains authority from its name or staff classification.
- Implement exact department/section membership and direct-student targeting only.
  Membership expiry does not erase existing obligations; groups and hierarchy remain unimplemented.
- Publish activity, targets and history atomically; lock per assignment for completion/review.
  Duplicate submission is a visible 409, not a second record or a fabricated success.
- Preserve start-inclusive/deadline-exclusive submission rules. Start < deadline <= end.
  Late work, return/resubmit, policy edits and recurrence need later approved semantics.
- Explicit category rows replace a closed enum; extension still requires a new capability.
- Keep read APIs paginated, requests bounded and actor/state/targeting inputs allowlisted.
  Read/modify errors remain visible and credentials/upstream SQL are not returned.

Implementation guidance: [Supabase database functions](https://supabase.com/docs/guides/database/functions)
and [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
