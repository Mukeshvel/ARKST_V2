# Data access boundary

`identity.ts` reads only the verified session user's profile and current scoped
responsibilities using the public key plus that user's Supabase session. PostgreSQL
RLS is an independent enforcement layer. No service-role client or in-memory
substitute exists in application code. Every query error produces an explicit failure.
`activities.ts` reads Activity data under RLS and calls authorized transactional RPCs
with the same session client. No browser actor ID selects the caller. SQL constraints,
explicit RPC authorization and atomic history enforce mutation boundaries.
Migrations and SQL policy tests live in `supabase/` and have been executed locally;
see `docs/PROJECT_STATUS.md` and `docs/ACTIVITY_ENGINE.md` for evidence and limits.
