# Identity verification

`node scripts/test-local-identity.mjs` is a real integration suite. It does not mock
Supabase, inject invented sessions, skip unavailable services, or return a successful
result when setup fails. The suite requires a running application and an isolated
local Supabase stack with the identity migration applied.

## Guarded local execution

Use a disposable local instance without personal data. Start the application with
`APP_ENV=local`, `APP_ORIGIN`, `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` matching
the test process. In the test process only, set:

```text
APP_ENV=local
LOCAL_IDENTITY_TESTS=1
APP_ORIGIN=http://127.0.0.1:3000
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_PUBLISHABLE_KEY=<local public key from Supabase status>
LOCAL_SUPABASE_SERVICE_ROLE_KEY=<isolated local service-role key>
LOCAL_DATABASE_URL=postgresql://<local owner>:<local password>@127.0.0.1:54322/postgres
```

These are placeholders, not usable credentials. Do not put service-role credentials
in the Next.js application environment or any `NEXT_PUBLIC_` variable. The suite
refuses non-loopback URLs, query/fragment overrides and HTTP redirect following.
`LOCAL_IDENTITY_TESTS=1` asserts that the chosen instance is dedicated and disposable;
loopback alone cannot detect a manually configured tunnel to a remote database.

The suite creates unique synthetic `example.test` users with cryptographically random
passwords through Supabase Auth's admin API, provisions their database profiles using
the local service role, and authenticates through actual password login. Application
requests retain only cookies received from the server. No passwords or keys are logged.

## Coverage

- Authorized own-profile read, including the protected HTML page.
- Anonymous denial at the application and direct database API boundaries.
- Cross-user isolation; query-string IDs cannot choose the authenticated actor.
- Three simultaneous staff responsibilities independent of employment classification.
- Staff access does not expose unrelated student profiles.
- Role inserts/updates/deletes and profile privilege edits are denied to users.
- Editable Auth metadata cannot grant a role or impersonate another user.
- Inactive and unprovisioned users are denied.
- Wrong credentials, malformed cookies and cross-origin mutations are denied.
- Public email signup remains disabled even while the existing-user email provider is enabled.
- Logout clears the application cookie session and subsequent access fails.
- A genuine PostgreSQL exception produces a visible 503 and recovers after cleanup.

For the last case, the suite installs a uniquely named restrictive SELECT policy on
`profiles`, backed by a function that raises only for its generated test user's Auth
ID. This is a real database failure, not a simulated app response. It requires a local
database owner connection (`pg` is used only by this test script). The suite removes
its policy/function/schema in `finally`, deletes only accounts it created and removes
its generated scope. Cleanup errors fail the run and print affected object IDs.
Forced process termination may prevent cleanup; use a dedicated disposable instance
and reset it before rerunning. No persistent database-wide grants are weakened.

The pgTAP suite in `supabase/tests` separately checks database policies using explicit
database role/JWT context. Those are policy tests, not evidence that Supabase login or
browser session handling worked. Unit tests use pure functions and likewise provide
no real authentication evidence. Neither suite substitutes for the other.

## Current verification limitation

For Milestone 2.1, Docker, project-local Supabase CLI and PostgreSQL were available.
The real application suite passed 12 groups, and the separate pgTAP suite passed 36
assertions against that local stack. Browser visual checks, refresh-token rotation,
OAuth, stolen-token replay after logout, provider outages and production infrastructure
are not covered by this script.

Supabase logout revokes refresh-session access, but a previously issued access JWT may
remain valid until its expiry. Clearing an application cookie is not proof of immediate
global JWT revocation. See [Supabase sign-out guidance](https://supabase.com/docs/guides/auth/signout).
