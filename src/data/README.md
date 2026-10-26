# Data access boundary

`identity.ts` reads only the verified session user's profile and current scoped
responsibilities using the public key plus that user's Supabase session. PostgreSQL
RLS is an independent enforcement layer. No service-role client or in-memory
substitute exists in application code. Every query error produces an explicit failure.
Migrations and SQL policy tests live in `supabase/`; they have not been executed here.
