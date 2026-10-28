# How the app works

ARKST has a browser interface, Next.js server routes and PostgreSQL. Most private
browser calls go to a route under `src/app/api/`. That route gets the authenticated
Supabase client, validates input, and calls `src/data/` or a named SQL RPC. The
database makes the final permission and persistence decision.

## Trace one NPTEL Activity

1. An approved coordinator opens the [faculty dashboard](../../src/app/dashboard/faculty/faculty-dashboard.tsx). The screen loads the creation choices the server says are available; it does not create a capability itself.
2. To target Sections A and B, the screen sends a POST to [the section route](../../src/app/api/activities/sections/route.ts). Selected students use a separate [selected route](../../src/app/api/activities/selected/route.ts); groups use [the group publication route](../../src/app/api/groups/[id]/activities/route.ts).
3. [The request wrapper](../../src/auth/activity-http.ts) requires a real active identity, checks the exact Origin for writes, and limits JSON size. [Input validation](../../src/core/activity-input.ts) checks dates, IDs, category and shape.
4. [The data module](../../src/data/activities.ts) calls `create_section_activity` with the caller's session. SQL checks current CREATE authority for the category and _each selected section_, finds eligible active linked students, and writes one Activity, unique assignments and actor history in a transaction. The later section/selection migrations extend the [shared Activity foundation](../../supabase/migrations/20261027000100_activity_engine.sql).
5. The student opens [My activities](../../src/app/dashboard/student/student-dashboard.tsx). PostgreSQL RLS returns only their own assignments. The student reports completion through [the submit route](../../src/app/api/activity-assignments/[id]/submit/route.ts). A verification-required Activity stays `reported` until a separately authorized reviewer verifies it.
6. The creator opens [creator results](../../src/app/dashboard/faculty/activities/[id]/creator-results.tsx). A counselor opens [counselor results](../../src/app/dashboard/counselor/activities/[id]/counselor-results.tsx) and sees only current trusted mappings. A separately granted supervisor opens [department overview](../../src/app/dashboard/supervision/supervision-board.tsx).
7. Publication creates recipient inbox/outbox records; [the notifications guide](HOW_NOTIFICATIONS_WORK.md) explains the optional desktop delivery step.

For example, a teacher might choose NPTEL with a Friday deadline. ARKST does not
host the NPTEL exercise. It records who was assigned, who reported completion, who
verified if required, and which staff may read those records.

## Screens do not set authority

[Dashboard navigation](../../src/app/dashboard/dashboard-nav.tsx) offers links based
on account kind and a current counselor responsibility. A user may still receive a
403 on a page or mutation without the independent database grant. The SQL function
and RLS policy are authoritative; hiding a link is a usability choice, not a lock.

## Where an error goes

Input errors and missing permission become explicit HTTP errors. The data modules
map known PostgreSQL codes, and unknown database failures become 503 rather than a
success message. Client screens show loading, saved and error states from actual
responses. A transaction means a failed history or outbox insert also rolls back
the parent operation.

## What is local versus deployed

The code and synthetic local tests cover the main workflows. The repository does
not contain real college accounts or roster data. Google OAuth needs the approved
provider; the hosted calendar and push runners need a configured always-on host.
See [release operations](../RELEASE_OPERATIONS.md) before treating these paths as
production operation.
