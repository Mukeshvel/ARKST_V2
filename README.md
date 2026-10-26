# ARKST — identity foundation

Milestone 1 foundation is preserved. Milestone 2 adds real Supabase identity code
and SQL migrations, but **live Auth/RLS integration is not yet verified** because
Docker and Supabase CLI are unavailable in the implementation environment.
There is no academic dashboard, activity workflow or fake connected service.

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
Google OAuth and hosted onboarding are not enabled. Never put service-role keys in
the application environment; they are only used in separate isolated test setup.

```sh
npm run check
npm start
# In another terminal, with the server running:
npm run test:smoke
```

`check` runs format, strict type checks, lint, pure unit/guard tests and production
build. It does not substitute for the two real database suites:

```sh
npm run test:rls
npm run test:identity
```

These require an already installed CLI/running isolated stack, migrations and explicit
local test configuration. They fail rather than skip-pass when prerequisites are absent.
See [IDENTITY_TESTS](docs/IDENTITY_TESTS.md). Set `SMOKE_ORIGIN` for another local port.
`npm run format` applies formatting; `npm run test:watch` runs Vitest in watch mode.

## Source map

- `src/app`: foundation, login and protected profile UI; login/logout and own-profile API.
- `src/proxy.ts`: cookie refresh and private response headers; not a permission bypass.
- `src/auth`: server-only Supabase clients, verified identity, request/error handling.
- `src/data`: own-profile and responsibility queries using the user's session and RLS.
- `src/core`: preserved framework-free activity rules and tests.
- `src/config`: origin/service configuration validation and tests.
- `supabase`: local config, reproducible migration and pgTAP policy tests.
- `scripts`, `tests/integration`: smoke and real isolated Auth/database/HTTP tests.
- `docs`: architecture, domain, permissions, decisions, setup and evidence.

Start subsequent sessions with [PROJECT_STATUS](docs/PROJECT_STATUS.md), then read
[DECISIONS](docs/DECISIONS.md) and [PERMISSIONS](docs/PERMISSIONS.md). Scope stops at
Milestone 2. Do not treat authored SQL or tests as executed. No remote resources,
production migrations, deployments, commits or pushes were made. Zero paid
infrastructure remains a target; hosted capacity/recovery requirements are undecided.
