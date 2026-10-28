# ARKST V2 — Go account handoff (updated 2026-10-28)

Read this with `PROJECT_STATUS.md`, `WORKFLOWS.md`, `PERMISSIONS.md` and
`RELEASE_OPERATIONS.md`. This document records the repository's release-preflight
state; it does not certify a deployed product. At this review's start `main` was
clean at **committed `97a545d`** (`docs: Add human-readable ARKST codebase guide`).
Session 3 is already included in earlier committed history. Confirm
`git status --short --branch` before any future change. This preflight changes
documentation only; it does not connect to remote Supabase, deploy or reset data.

## VISION

One department can manage official student/staff identities, scoped Activities,
group and section targeting, completion, counseling, follow-up, escalation,
catch-up, announcements, calendar blackouts and notifications without new source
code for each coordinator title or student group. External academic work remains
outside ARKST; ARKST records assignment and reported/verified state.

## CURRENT

Next.js 16 App Router, TypeScript, React, Supabase Auth/PostgreSQL/RLS, server-side
caller-session data access and SQL RPCs. `src/app` holds pages and authenticated API
routes; `src/auth`, `src/data`, `src/config`, `src/core` hold session/security,
database access, configuration and pure rules. `supabase/migrations` is forward
history, `supabase/tests/database` is pgTAP, `scripts` contains local verification,
trusted administrative operations and runner entry points, `deploy/systemd` holds
inactive hosting examples, and `docs` records architecture/operations.

The latest Session 3 migrations are `20261028002300_roster_email_identity.sql`
(unique approved roster email) and `20261028002400_trusted_operator_history.sql`
(private audit for trusted operations). Earlier key tables are `profiles`,
`scopes`, `responsibility_assignments`, `activity_capabilities`,
`department_student_roster`, `student_scope_memberships`, `counselor_student_mappings`,
`activities`, `activity_assignments`, `activity_completions`,
`activity_history`, `announcements`, `academic_groups`, group membership/history,
calendar schedules/slots/instances/blackouts/conflicts, follow-up/escalation and
catch-up tables, `notifications`, push subscriptions and delivery outbox/history.
Read the migration files for exact columns, constraints and RLS.

The current working app uses a Supabase publishable/anon key and the authenticated
user's session. Staff profile text and preferred sections are descriptive. Real
authority comes from current trusted responsibilities, exact department/section
scope and separate CREATE, VERIFY, group, calendar and supervision grants. Current
counselor mappings alone give narrowly scoped counselor visibility. HOD/admin are
separately controlled. Global signup must remain disabled; institutional email
domain alone grants no access. Owner/service credentials are restricted to local
tests or an explicit trusted operator process, never the web app.

## COMPLETED

- Milestones 1–5: identity, roster/self-service, shared Activity assignments and
  completion/verification, scoped views, notifications/inbox/outbox and locally
  observed Windows Web Push delivery/click. See `PROJECT_STATUS.md` for the exact
  prior evidence and limits.
- Session 1: follow-ups, pending attention, trusted escalation stages, catch-up
  review/publication, audit and authorized pages. Session 2: dynamic groups with
  assignment snapshots, configurable recurring external test windows, blackout
  conflicts, authorized supervisor views and real browser checks.
- Session 3 application-side work: disabled-by-default Google PKCE start/callback,
  existing-profile authorization gate, server-side trusted roster email/account
  linking and correction commands, capability/route operator commands with audit,
  hosted runner entry points and inactive systemd scheduling examples. These do
  **not** establish live Google login or hosted notifications.
- Existing local tests exercise synthetic Auth users, PostgreSQL, RLS, APIs and
  headless Edge UI. Consult the latest Session 3 entry in `PROJECT_STATUS.md` for
  exact final test counts; do not infer passing results from this list.

## NEXT

1. Review the committed `main` checkpoint and the preflight checklist in
   `RELEASE_OPERATIONS.md`. The Session 3 and codebase-guide work is already
   committed; do not reconstruct it or create a new feature branch for staging.
2. Obtain institutional approval and the official roster with unique student
   identifiers, names, sections and verified email addresses; approved staff list,
   counselor mapping, role/capability grants, exact schedule hours, blackout dates,
   and escalation routes. Preview all imports before apply.
3. Choose a reliable Node/HTTPS host, hosted Supabase project, backup/restore plan,
   secret custody and monitored timers. Follow `RELEASE_OPERATIONS.md` in staging.
4. Configure and test Google OAuth with real approved accounts; then test hosted
   password-disabled login, refresh/logout, denial of unapproved accounts and
   institutional identity linking.
5. Perform hosted end-to-end and college-user acceptance, including real desktop
   push with the tab closed and restart/retry behavior. Release only after evidence.

## BLOCKED

- Google provider exchange and hosted login: require Google Cloud/Supabase account
  access, approved redirect origins and client credentials. App code alone is not
  proof of provider behavior.
- Actual college operation: requires approved real student/staff data, authorized
  initial admin bootstrap, institution-specific policy and faculty/student review.
- Laptop-independent push/calendar: requires a running paid or otherwise suitable
  trusted host, database connectivity, secret handling and active monitored timers.
  The included timers are examples and have not run in hosting.
- Production data protection: a hosted backup/restore exercise, monitoring, TLS,
  migration rehearsal and privacy review are outstanding.
- Selected-Activity counselor reporting is now implemented and locally verified.
  Staging must apply forward migration `20261028002500_activity_supervision.sql`
  and verify the approved HOD supervision grant; hosted acceptance remains pending.

## FUTURE

Only after a safe release: improve bulk administration UI if CLI operation is too
costly, add institution-approved retention/export policy, accessibility and load
review with actual devices, and revisit scheduler architecture if chosen hosting
cannot sustain the Node jobs. Do not create category-specific tracking databases.

## DECISIONS

- Preserve one shared Activity/completion model. Group publication snapshots
  recipients so later membership changes do not rewrite published assignments.
- Do not turn profile preference, designation, institutional email, or Google
  account metadata into capabilities. Require trusted exact scope grants.
- Google OAuth is opt-in and fail-closed; keep local password login limited to
  isolated loopback development. Do not open public signup.
- Administrative owner DB tools preview by default, require a current department
  admin, transactionally recheck changes and record trusted audit; hosted use is
  explicit and TLS checked, pending external verification.
- Keep a short recurring publish horizon so staff can enter blackouts before
  future tests. Do not silently alter already published Activities.
- Keep provider acceptance, browser reception and Windows display as distinct
  push verification stages; at-least-once dispatch can duplicate after a crash.

## OPEN QUESTIONS

- What institution-owned HTTPS domain and hosting budget/SLA are approved?
- Which Google Workspace or Cloud administrator owns the OAuth consent/client,
  and is the student/staff verified email policy approved?
- Who may bootstrap first HOD/admin and rotate/revoke scheduler/operator secrets?
- What are the exact test times, academic blackouts, escalation contacts,
  follow-up policy, data retention and recovery targets?
- Which approved roster and counselor allocation source is authoritative, and
  who signs off the preview before importing real records?

## First commands for the next developer

Use Node 24 and inspect `git status`, `git diff`, `git log -1`, and the latest
`PROJECT_STATUS.md` before editing. Never reset the existing local database.
With Docker and the isolated stack running, set `SUPABASE_HOME` to the ignored
`.supabase-home` directory and run `npx supabase migration list --local` to compare
local/recorded migration heads. Run `npm run check`, `npm run test:rls`, then set
`APP_ENV=local` and `LOCAL_IDENTITY_TESTS=1` and run `npm run test:local`.
The wrapper starts a temporary production Next server and cleans synthetic test
fixtures. No real college accounts are created by this suite. Read
`RELEASE_OPERATIONS.md` before any staging action; never point local tests or the
owner CLI at a production database.
