# How authentication works

**Authentication** answers “which Supabase user is this?” **Authorization** answers
“may this user assign NPTEL to Section B or read this student?” ARKST checks both.

## Sign-in and cookies

[The login page](../../src/app/login/page.tsx) shows password sign-in only for
isolated loopback `APP_ENV=local`. [The password route](../../src/app/auth/login/route.ts)
uses real Supabase Auth; it does not accept a chosen role or fake account. The
optional Google button is shown only with `GOOGLE_OAUTH_ENABLED=true`. Its
[start route](../../src/app/auth/google/route.ts) requests a Supabase PKCE
authorization URL; the [callback](../../src/app/auth/google/callback/route.ts)
exchanges a real code and requires an existing approved profile. No real Google
provider was configured or verified in the project.

[The server client](../../src/auth/server.ts) stores the Supabase session in
HttpOnly, SameSite=Lax `arkst-session` cookies; HTTPS origins use Secure cookies.
[Next.js Proxy](../../src/proxy.ts) refreshes the session and applies private cache
headers. It is not the final permission check.

## Every protected request

[requireOwnIdentity](../../src/auth/identity.ts) asks Supabase for both JWT claims
and the current Auth user, checks the IDs agree, then loads the matching active
[profile](../../src/data/identity.ts) and current responsibilities. A valid Google
address, confirmed institutional domain or editable designation cannot create a
staff capability. The SQL grants are separate and effective-dated.

Example: a faculty member signs in and writes “NPTEL Coordinator” as a designation.
That text may appear on their profile. They still cannot create NPTEL work until a
trusted operator grants the NPTEL CREATE capability for the approved scope. They
cannot see private counselor records without an active approved counselor mapping.

## Writes and logout

[Protected Activity routes](../../src/auth/activity-http.ts) require the configured
same Origin and bounded JSON. Other request helpers perform analogous checks.
[Logout](../../src/app/auth/logout/route.ts) signs out the local session and clears
the application cookies. A copied access token may remain valid until its expiry;
logout is not immediate revocation of a stolen token.

## What to check before changing auth

Read [identity configuration](../../src/config/identity.ts), [Auth errors](../../src/auth/errors.ts), [the identity foundation SQL](../../supabase/migrations/20261026000100_identity_foundation.sql) and [database/RLS](HOW_DATABASE_AND_RLS_WORK.md). Run `npm run check`, `npm run test:rls`, and `npm run test:local -- identity` against the isolated local stack. A real Google login also requires separate hosted provider and browser verification; the local PKCE boundary test does not establish it.
