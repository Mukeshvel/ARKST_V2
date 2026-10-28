# Release operations — Session 3 preparation

This is an operator plan, not a record of deployment. No hosted Supabase project,
Google provider, DNS name, scheduled process or production roster has been configured
or tested by Session 3. Review institutional policy, obtain the approved records and
credentials, and test in a staging project before admitting college users.

## Release boundary and environment

Use Node 24, PostgreSQL/Supabase versions compatible with the checked-in migrations,
an HTTPS public origin and a trusted host that can run the Next.js process plus two
short-lived Node jobs. Keep the web, calendar, push and trusted administrative process
environments separate. The web process needs only `APP_ENV=hosted`, `APP_ORIGIN`,
`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `GOOGLE_OAUTH_ENABLED` and the public
`PUSH_VAPID_PUBLIC_KEY`. Never give it a database owner URL, service-role key, VAPID
private key or scheduler password. See `.env.example` for the process-specific names.

The included `deploy/systemd` units are examples for one trusted Linux Node host.
They have not been activated. Put secrets in root-owned environment files outside
the repository, tighten file permissions, update the absolute `WorkingDirectory`
and `ExecStart` paths, and put a TLS reverse proxy in front of Next.js. Review the
unit files with the actual service account and `systemd-analyze verify` on that host.
Start the web service after installing from the lockfile and building. Run the push
timer every minute and the calendar timer hourly. Only one host should own each
timer until concurrent operation has been reviewed. Database claims and unique
occurrence constraints protect normal retry/idempotence, but a process can crash
after a push provider accepts a message and before the acceptance is recorded;
duplicate delivery is therefore possible. Monitor retries and terminal failures.

Do not assume a free hosting tier can sustain this setup. In particular, Vercel
Hobby cron is limited to daily schedules, which cannot run this minute-level push
dispatcher unchanged. Supabase Free projects can pause, and free-tier database
backup/recovery must be planned separately. See the current [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing),
[Supabase project pausing](https://supabase.com/docs/guides/platform/free-project-pausing),
[Supabase backups](https://supabase.com/docs/guides/platform/backups), and
[Next.js self-hosting guide](https://nextjs.org/docs/app/guides/self-hosting) before choosing a plan.

## Staged deployment sequence

1. Record the reviewed Git commit, Node version, migration head and an encrypted
   backup/restore test. Do not copy synthetic local users into production.
2. Create an approved hosted Supabase project. Keep public signup disabled. Configure
   an approved HTTPS Site URL and an exact redirect allowlist containing
   `https://YOUR-APP-ORIGIN/auth/google/callback`. Configure the provider as below.
3. Apply **only unapplied** checked-in migrations to staging, in version order. Use
   `npx supabase migration list --linked`, then
   `npx supabase db push --linked --dry-run --skip-vault`, and finally
   `npx supabase db push --linked --skip-vault` only
   after linking the **approved staging project**, reviewing the target and obtaining
   operator approval. Repeat for production only under a separate change window.
   This session did not invoke either remote command. Verify schema and RLS there.
4. Install with `npm ci`; run `npm run check` and `npm run build`; deploy the built
   Next.js process behind HTTPS with a stable origin. Keep the browser service worker
   at `/push-worker.js` on that same origin. Configure secrets in protected service
   files or a secret manager, never in the repository or `NEXT_PUBLIC_*` variables.
5. Provision one approved admin and restricted scheduler identity through the
   approved Auth console/operator process; grant only the exact department scopes
   and category/operation capability needed. The calendar runner signs in with an
   existing email/password Auth account; if this path is used, keep the email
   provider enabled for sign-in while global signup remains disabled. Keep its
   password out of the web process and rotate it under the host's secret procedure.
   Import and link the approved roster,
   staff, counselors, routes and calendar as below. Preview every operator change.
6. Start the push/calendar timers only after a staging run with synthetic accounts,
   an outbox job and a blackout. Check service status, run logs and DB delivery rows.
7. Repeat end-to-end browser checks as an approved staff member and student. Include
   Google sign-in, session refresh/logout, RLS denial, assignment, completion,
   follow-up, catch-up, recurrence, notification permission, provider response,
   actual desktop popup and click. Provider HTTP 201 alone is not desktop evidence.

Back up before migration and roster changes. A restore exercise must cover Auth,
public tables, private audit history and notification state. Use forward migrations
for corrections. Do not reset a populated database. Record migration history and
restore point before changing configuration. If a scheduled job fails, leave its
persisted outbox/occurrence state intact, correct the cause, then rerun; inspect
logs and database rows instead of manually marking work successful.

## Google OAuth setup and trust boundary

The app now has a disabled-by-default server-side Supabase Google PKCE start and
callback. Set `GOOGLE_OAUTH_ENABLED=true` **only after** the approved hosted Google
OAuth client and Supabase Google provider are configured. In Google Cloud, create a
Web application OAuth client for an institution-approved consent screen, with the
exact Supabase Auth callback URI shown by the hosted project's Google provider
settings (`https://YOUR-PROJECT.supabase.co/auth/v1/callback`). Store its client ID
and secret **in Supabase Auth provider settings**, not in ARKST or Git. In Supabase,
allow the exact ARKST `/auth/google/callback` redirect and set the HTTPS Site URL.
Check the current [Supabase Google guide](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)
and [redirect URL rules](https://supabase.com/docs/guides/auth/redirect-urls).

Provision approved existing Auth identities and linked active profiles first. The
callback exchanges the code for a real Auth session, then requires a confirmed Auth
user with an active ARKST profile. PostgreSQL responsibilities and grants remain the
only source of staff/counselor/administrator authority. An institutional domain,
Google account label, user metadata or self-edited designation grants nothing.
Use a staging user to verify the exact approved-email identity-linking behavior
under the chosen Supabase configuration. Do not enable public signup to solve a
provisioning problem. Local password login remains restricted to loopback local mode.
Google provider exchange, identity linking and hosted session behavior are **blocked
until credentials and an approved project exist**.

## Real-data administration

The CLI takes a current exact-department admin operator UUID and department UUID,
prints a preview, then commits only with `--apply`. Local mode needs
`LOCAL_DATABASE_URL` pointed at isolated loopback PostgreSQL. Hosted trusted operator
mode needs `APP_ENV=hosted`, `ARKST_HOSTED_ADMIN_ENABLED=true`,
`ADMIN_DATABASE_URL` and `--database-host` equal to the URL's approved remote host.
The hosted URL requires TLS certificate validation. Run this tool only in an
approved, restricted operator environment; it uses an owner connection and has no
browser endpoint. Its hosted connectivity has **not** been tested.

Use these exact CSV headers and preview each file before `--apply`:

| Purpose               | Command               | Required header                                                                                                |
| --------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------- |
| Initial roster        | `import-roster`       | `student_identifier,display_name,section_scope_id,linked_student_id` with optional final `institutional_email` |
| Roster correction     | `update-roster`       | `student_identifier,new_student_identifier,display_name,institutional_email`                                   |
| Initial counselor map | `import-counselors`   | `student_identifier,counselor_responsibility_id,starts_at`                                                     |
| Reassignment          | `reassign-counselors` | `student_identifier,counselor_responsibility_id`                                                               |
| Revocation            | `revoke-counselors`   | `student_identifier`                                                                                           |

Identifiers are strings and need not be consecutive. Keep leading zeros intact in
the CSV. The optional roster email must be unique across the roster; account
linking requires an exact confirmed Auth email match to that approved roster email.
An empty `linked_student_id` imports a roster-only row, not an account. Use
`provision-student --student IDENTIFIER --user AUTH_UUID --email APPROVED_EMAIL`
to link an existing confirmed Auth user after roster import. Preview, inspect,
then add `--apply`. `provision-staff` similarly requires an existing confirmed
Auth account; see `docs/DEPARTMENT_DIRECTORY.md` for its status/section/category
arguments. No command creates real college Auth accounts automatically.

`npm run admin:operations:local -- assign-responsibility`, `grant-activity`,
`set-route` and `end-responsibility` operate on existing approved identities;
all require `--operator` and `--department`, preview by default and add `--apply`
to commit. `grant-activity` requires exact `--responsibility`, `--category`,
`--create true|false` and `--verify true|false`. `set-route` requires exact
`--section`, `--role coordinator|branch_coordinator|hod`, and
`--responsibility UUID|none`. Ordinary role assignment excludes HOD/admin;
an initial elevated authority requires a separate institution-approved bootstrap
procedure. A route change with an open case is blocked for manual disposition.
Department group/calendar/supervision grants use `grant-operations` with a current
responsibility; see `docs/DEPARTMENT_DIRECTORY.md`. Group membership, schedules,
slot windows, blackouts, Activity deadlines and announcements are managed in the
authenticated app once explicit capabilities are provisioned.

## Monitoring and recovery checks

- Web: check HTTPS `/api/me` anonymous response (401), login callback, authenticated
  profile and role-specific pages, reverse proxy logs, process restarts and health.
- Calendar: inspect last timer run, exit status, published/blocked/existing counts,
  unique occurrence rows and conflicts. A blackout must produce no new assignments
  or notification outbox jobs for a blocked occurrence.
- Push: inspect timer exit status, due/retry/failed jobs and recent provider
  responses. Avoid logging endpoints, payload bodies, keys or DB URLs. Verify an
  actual browser popup separately from provider acceptance.
- Database: monitor connection limits, storage, backup completion, migration parity,
  and RLS/permission regression checks after every change.
- On failure: preserve persisted jobs and records, record the exact error/status,
  fix configuration or provider reachability, then run one controlled retry. Do not
  delete history or mark a job delivered merely to clear a dashboard.

Local evidence commands (with the existing isolated stack; no reset):

```powershell
$env:SUPABASE_HOME = Join-Path (Get-Location) '.supabase-home'
npx supabase migration list --local
npm run test:rls
npm run check
$env:APP_ENV = 'local'
$env:LOCAL_IDENTITY_TESTS = '1'
npm run test:local
```

The manual production acceptance checklist must additionally include backup/restore,
approved real-data import, real Google account sign-in and denied unapproved account,
deployed HTTPS push and click with the app tab closed, scheduler restart/retry,
permission revocation, and staff/student usability review. None has been claimed by
this document as completed.
