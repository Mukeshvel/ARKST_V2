# Start here: learn ARKST one path at a time

ARKST V2 is one Next.js application backed by Supabase Auth and PostgreSQL. A student
does academic work outside ARKST, then reports it against an assigned Activity. Staff
create, monitor and sometimes verify that work. Trusted administrator records define
who may act and which students they may see.

## A useful reading route

1. Read [How the app works](HOW_THE_APP_WORKS.md) for the screen → API → database path.
2. Read [Authentication](HOW_AUTHENTICATION_WORKS.md) and [database/RLS](HOW_DATABASE_AND_RLS_WORK.md) before changing anything private.
3. Follow the NPTEL example in [Activities and completion](HOW_ACTIVITIES_AND_COMPLETION_WORK.md).
4. Then read [notifications](HOW_NOTIFICATIONS_WORK.md), [follow-up/catch-up](HOW_FOLLOWUP_AND_CATCHUP_WORK.md) and [scheduling](HOW_SCHEDULING_WORKS.md).
5. Use [safe changes](HOW_TO_SAFELY_MODIFY_CODE.md) as a checklist. Open [the complete file index](FILE_INDEX.md) to find one specific file's A–G explanation.

Known functional and deployment limits are listed separately in
[Potential concerns](POTENTIAL_CONCERNS.md).

The shortest source-code path to trace is:

```text
src/app/dashboard/faculty/faculty-dashboard.tsx
    → src/app/api/activities/sections/route.ts
    → src/auth/activity-http.ts
    → src/data/activities.ts
    → supabase/migrations/20261027000100_activity_engine.sql
    → later section/monitoring migrations
```

Read those files in that order. The React screen gathers a request; the API checks
the signed-in caller and input; the data module calls PostgreSQL; SQL decides whether
the exact category, section and student set are allowed. A button being visible is
never proof of authorization.

## Project map

| Place                      | What to look for                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------- |
| `src/app/dashboard/`       | Student, faculty, counselor, group, calendar, inbox and supervision screens.           |
| `src/app/api/`             | HTTP routes called by those screens. `route.ts` is the entry point for its URL.        |
| `src/auth/`                | Cookies, verified identity, same-origin and request-size checks.                       |
| `src/core/`                | Framework-independent input validation and status calculations.                        |
| `src/data/`                | Server-only calls made with the signed-in user's Supabase session.                     |
| `supabase/migrations/`     | Tables, constraints, RLS policies and trusted SQL functions, applied in version order. |
| `scripts/`                 | Trusted operator commands, schedulers and real local integration suites.               |
| `supabase/tests/database/` | pgTAP assertions for RLS, grants and trusted functions.                                |
| `deploy/systemd/`          | Inactive Linux hosting examples; their presence does not mean a service is running.    |

## First concepts

- **Auth user**: a real account managed by Supabase. Signing in alone gives no staff power.
- **Profile**: an active ARKST record linked to that Auth UUID.
- **Responsibility**: a trusted, effective-dated staff assignment in a scope.
- **Capability**: a separate, explicit operation grant, such as CREATE for NPTEL or supervision for a department.
- **Roster and counselor mapping**: approved records that identify a student and the counselor allowed current access.
- **Activity assignment**: one durable student-specific obligation. A completion report belongs to that assignment.
- **RLS**: PostgreSQL's row-level check on what an authenticated caller may read.

The previous local verification is documented in
[Project status](../PROJECT_STATUS.md). It does not prove Google OAuth, hosted push,
production data or college-user acceptance. Those require the external setup in
[Release operations](../RELEASE_OPERATIONS.md).
