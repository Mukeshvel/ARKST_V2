# Authentication boundary

Supabase SSR clients and verified identity checks are server-only. `identity.ts`
verifies claims and the current Auth user before loading the own active DB profile.
`http.ts` validates mutation origin and bounded form input; `errors.ts` exposes
sanitized denial/unavailability errors. No identity or role is fabricated.
Proxy refreshes cookies but is not the authorization boundary. See
`docs/ARCHITECTURE.md`, `docs/PERMISSIONS.md` and `docs/PROJECT_STATUS.md` for limits.
