# ARKST V2 — scoped college Activity operations

Milestones 1, 2.1 and 3A are preserved. Milestone 3B-1 adds a structured department
roster, approved counselor-student mappings and self-service staff profiles on the real
PostgreSQL Activity and identity foundation. See [PROJECT_STATUS](docs/PROJECT_STATUS.md),
[ACTIVITY_ENGINE](docs/ACTIVITY_ENGINE.md) and [DEPARTMENT_DIRECTORY](docs/DEPARTMENT_DIRECTORY.md)
for evidence, workflows and permission boundaries. No real departmental roster was imported.

Use Node.js 24 LTS and npm:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. The foundation loads without a database. Identity endpoints
fail closed with an explicit configuration error until configured. Copy `.env.example`
to `.env.local` for app configuration; never add secrets to tracked files.

For genuine local login, follow [LOCAL_SUPABASE](docs/LOCAL_SUPABASE.md). Password login
requires `APP_ENV=local`, a loopback `APP_ORIGIN`, a loopback `SUPABASE_URL` and the
local publishable/anon key. Use the exact APP_ORIGIN in your browser. No public signup
or role assignment exists. Only trusted operators provision profiles and scoped roles.
Google OAuth has an opt-in application path but requires approved Google/Supabase
provider setup and real hosted verification. Never put service-role or owner keys in
the application environment; trusted operator processes use a separate environment.

```sh
npm run check
npm start
# In another terminal, with the server running:
npm run test:smoke
```

`check` runs format, strict type checks, lint, pure unit/guard tests and production
build. It does not substitute for the real database suites. On Windows PowerShell,
with the existing isolated local stack running:

```powershell
$env:SUPABASE_HOME = Join-Path (Get-Location) '.supabase-home'
npx supabase migration up --local
npm run test:rls
$env:APP_ENV = 'local'
$env:LOCAL_IDENTITY_TESTS = '1'
npm run test:local
```

The local runner reads generated local keys into memory, starts a production Next server
on an ephemeral loopback port, runs smoke/identity/Activity suites, then stops that server.
Admin credentials are omitted from the app environment. Tests fail when prerequisites are absent.
See [IDENTITY_TESTS](docs/IDENTITY_TESTS.md). Set `SMOKE_ORIGIN` for another local port.
`npm run format` applies formatting; `npm run test:watch` runs Vitest in watch mode.

## Source map

- `src/app`: status, login/profile UI; identity and Activity APIs.
- `src/proxy.ts`: cookie refresh and private response headers; not a permission bypass.
- `src/auth`: server-only Supabase clients, verified identity, request/error handling.
- `src/data`: identity/Activity queries and mutation RPCs using the user's session.
- `src/core`: preserved framework-free activity rules and tests.
- `src/config`: origin/service configuration validation and tests.
- `supabase`: local config, reproducible migration and pgTAP policy tests.
- `scripts`, `tests/integration`: smoke and real isolated Auth/database/HTTP tests.
- `docs`: architecture, domain, permissions, decisions, setup and evidence.

Start subsequent sessions with [GO_ACCOUNT_HANDOFF](docs/GO_ACCOUNT_HANDOFF.md),
[PROJECT_STATUS](docs/PROJECT_STATUS.md) and [RELEASE_OPERATIONS](docs/RELEASE_OPERATIONS.md).
The current code includes Milestones 1–5 and the completion sprint workflows. Do not
treat local verification as hosted readiness. Session 3 made no production migration,
deployment, commit or push; hosted capacity and recovery still require approval.
