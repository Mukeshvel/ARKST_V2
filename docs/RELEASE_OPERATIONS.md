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
   at `/arkst-push-sw.js` on that same origin. Configure secrets in protected service
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

## Final staging preflight — 2026-10-28

**Decision:** the committed application is a reasonable candidate for an **initial
isolated staging deployment**. The latest recorded local run passed 37/37 migration
history entries, 456 pgTAP assertions, 103 real local integration groups, unit/Node
tests, type checks, lint and a production build (see `PROJECT_STATUS.md`). These
are local results, not hosted acceptance. No staging project, host, Google provider
or hosted timer was connected during this review.

**Simplest fit for the existing code:** one institution-approved, always-on Linux
Node 24 host running `next start` behind an HTTPS reverse proxy, plus the existing
minute push and hourly calendar systemd timers, with Supabase hosting Auth and
PostgreSQL. It uses the checked-in Node commands without converting them to Edge
Functions or adding a second database. An institution-managed VM is suitable if
its operator can maintain TLS, OS updates, secret files, monitoring and backups;
a managed VM can provide the same runtime with a recurring host charge. The app
should not depend on the developer's Windows laptop after these services are
installed and observed on that host. [Next.js self-hosting guidance](https://nextjs.org/docs/app/guides/self-hosting)
recommends a reverse proxy in front of the Node server.

Free service plans are useful for experiments, but zero cost and continuous
availability are **not** guaranteed. Supabase Free currently lists 500 MB
database storage, 50,000 monthly active users and 5 GB egress; it can pause after
low activity and has no automatic backups. Supabase Pro currently starts at
US$25/month with daily backups for the first project, before any extra usage or
additional project charges. The department's expected 124 students fit the
published _user-count_ allowance, but application storage, traffic, load and
recovery have not been measured in hosting. See [current pricing](https://supabase.com/pricing),
[project pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
and [backup guidance](https://supabase.com/docs/guides/platform/backups).
Vercel Hobby's cron minimum is once daily, so it cannot invoke the present
minute push timer and hourly calendar timer; it also has personal/non-commercial
terms requiring institutional review. Vercel's function cron does not directly
run the checked-in long-lived host/systemd setup. See [cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)
and [Hobby terms](https://vercel.com/legal/terms). Hosting, domain, backup storage,
network traffic and staff maintenance may cost money; select a provider and
obtain its actual quote before committing to a budget.

### Ordered manual setup for a first staging attempt

This expands the earlier deployment overview into the order a human operator
should follow; it does not authorize executing any remote command in this review.

1. **Institutional approval.** Name the data owner and two authorized operators;
   approve a staging host/domain, student-data handling, verified email source,
   initial admin, retention/backup target, counselor allocation and staff grants.
   Use synthetic accounts in staging until those decisions are recorded.
2. **Create isolated infrastructure.** Create a staging Supabase project and an
   always-on Node 24 Linux host. Record the exact staging project reference and
   database host separately from production. Point an approved HTTPS domain to
   the reverse proxy. Keep web, calendar, push and operator secrets in distinct
   protected environment files outside Git. The web file gets only the public
   Supabase key and public VAPID key; the push job gets the private VAPID key and
   trusted PostgreSQL URL; the calendar job gets its restricted Auth credential.
3. **Google and Auth.** In Google Cloud Console, have the institution's Google
   administrator approve the consent screen and create a **Web application** OAuth
   client. Put the exact Supabase Google-provider callback URL shown by that
   staging project (normally `https://PROJECT.supabase.co/auth/v1/callback`) in
   Google's authorized redirect URIs. Store client ID/secret only in Supabase's
   Google provider settings. In Supabase Auth URL Configuration, set the staging
   HTTPS Site URL and allow the exact
   `https://APP-ORIGIN/auth/google/callback` redirect. Keep **global public signup
   disabled**. Finish provider configuration here, but defer enabling the app's
   Google button and testing login until after the database and approved profiles
   are in place in steps 4–6. A matching college domain alone never grants a
   role. Then set `GOOGLE_OAUTH_ENABLED=true` on the web process and test both
   an approved and unapproved account in real browsers.
   Supabase documents [Google setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google),
   [redirect allowlisting](https://supabase.com/docs/guides/auth/redirect-urls)
   and [same-email identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking).
4. **Database rehearsal.** Verify the linked CLI target before any write. Check
   `npx supabase migration list --linked`; inspect a
   `npx supabase db push --linked --dry-run --skip-vault`. After an approved
   backup/restore rehearsal, apply only the reviewed missing migrations to the
   **staging** project. Recheck RLS, grants, function search paths and migration
   parity there. Do not link the existing local working directory to production
   by accident. No remote command in this paragraph was run in this review.
5. **Trusted initial setup.** A qualified database operator must create/verify
   the initial department and Section A/B `scopes`, a confirmed existing staff
   Auth account, its active `profiles` row and one exact-department `admin`
   `responsibility_assignments` row in an approved transaction. The ordinary
   CLI deliberately cannot self-bootstrap admin or HOD. Record the approval,
   actor, time and reviewed before/after data in the institutional change log;
   independently verify the bootstrap result before using that admin UUID for
   CLI imports. Never derive authority from an email prefix or designation.
6. **Approved records.** Prepare CSVs with the headers above. Preserve leading
   zeros in student identifiers. Preview `import-roster`; then link existing
   confirmed student Auth UUIDs with `provision-student` using the exact approved
   roster email. Preview `provision-staff` for each staff member. Add further
   ordinary responsibilities with `assign-responsibility`; use
   `grant-activity` for category CREATE/VERIFY and `grant-operations` for
   independent group/calendar/supervision access. Import counselor mappings,
   set exact section escalation routes, then use the authenticated app to create
   groups and enter the approved five-slot schedule and exam blackouts. Only
   apply each preview after an authorized human checks row counts and scope.
   The operator CLI needs its protected owner URL and exact database-host guard;
   it must run outside the web process.

   For example, in a restricted operator shell where the hosted admin environment
   has already been loaded from a protected file, preview one approved roster CSV
   before repeating the **same** command with `--apply` after human review:

   ```powershell
   node scripts/directory-admin.mjs import-roster --operator $AdminUuid --department $DepartmentUuid --database-host $ApprovedDbHost --file $ApprovedCsvPath
   # After checking the preview, repeat with --apply at the end.
   ```

   Never paste `ADMIN_DATABASE_URL` into a command line or report. Confirm the
   actual target host and project independently before any apply step. Separate
   commands `provision-student`, `provision-staff`, `import-counselors`,
   `reassign-counselors`, `grant-operations`, and the commands in
   `scripts/admin-operations.mjs` follow the same preview/apply rule.

7. **Start and observe services.** Install/build the committed app on the host,
   review the supplied systemd files against that host with
   `systemd-analyze verify`, and enable the web service behind HTTPS. Then enable
   the push timer once per minute and the calendar timer hourly. Calendar needs
   a dedicated confirmed staff account with current calendar and `weekly_test`
   CREATE grants. Push needs DB connectivity, TLS, outbound HTTPS access to the
   approved Web Push providers, the same VAPID key pair as the
   subscribed browser and a valid contact subject. Check timer logs, last exit
   status, claimed/attempted/failed outbox rows, calendar published/blocked counts
   and alerts for consecutive failures. If a job fails, preserve persisted rows,
   correct the cause and rerun once; avoid deleting or manually marking success.
8. **Accept staging before real data/production.** Complete every item below in
   the staging HTTPS environment with synthetic accounts first. Repeat with
   approved representative real users only after the privacy/data owner permits
   it. Back up, restore to a separate test target, and document the observed
   recovery time. Production needs its own approval and migration window.

The existing `npm run test:local` wrapper deliberately accepts loopback targets
only. Do **not** redirect it to staging or production. Perform the hosted checks
with an explicitly approved staging test plan and synthetic identities, and run
database security assertions only against an isolated/staging-safe target under
the data owner's change procedure.

### Human acceptance checklist

| Status now                                       | What the operator must observe                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Already completed locally**                    | Real local Auth/RLS/Activity/workflow tests, headless Edge UI checks and one normal-Chrome Windows notification/click; see `PROJECT_STATUS.md` for exact scope.                                                                                                                                                                                                                |
| **Manual account setup required**                | Supabase staging project, confirmed approved/unapproved Google accounts, restricted scheduler account, exact Auth redirect allowlist and Web OAuth client.                                                                                                                                                                                                                     |
| **Institutional approval required**              | Domain/hosting, official student and staff identities, initial admin/HOD bootstrap, counselor allocations, permissions, data retention, backup/recovery and real-user acceptance.                                                                                                                                                                                              |
| **Hosting configuration required**               | HTTPS proxy, Node 24 web process, protected per-process secrets, Postgres TLS connection, minute push timer, hourly calendar timer, logs/alerts and off-site backup.                                                                                                                                                                                                           |
| **Staging tests required**                       | Approved Google login and denied unapproved login; own-only Activity reads; section/group publication and completion; counselor isolation; follow-up/escalation; catch-up publication; five-slot recurrence, blackout and repeat-run idempotence; in-app and actual HTTPS desktop push with tab closed/click; timer restart/retry; backup/restore and RLS denial.              |
| **Selected-Activity HOD view: locally verified** | The additive `supervisory_activity_overview` RPC and Activity selector provide current counselor/unmapped results, full-scope totals and paged student detail. Existing all-activities reporting remains intact. Apply migration `20261028002500_activity_supervision.sql` during approved staging migration and perform hosted acceptance; no hosted verification is claimed. |
| **Ready for production**                         | **No.** Require the staging observations above, approved real-data import, recovery evidence and explicit release sign-off first.                                                                                                                                                                                                                                              |

The web app has no universal health endpoint. Check `/api/me` anonymously for the
expected 401, then authenticated pages and database-backed operations. For Web
Push, distinguish an outbox claim, provider acceptance, browser receipt, Windows
display and click navigation; none substitutes for the next stage. The current
dispatcher is at-least-once after a crash between provider acceptance and DB
recording, so duplicates remain a bounded operational possibility. A production
host must monitor that condition rather than promise exactly-once delivery.
