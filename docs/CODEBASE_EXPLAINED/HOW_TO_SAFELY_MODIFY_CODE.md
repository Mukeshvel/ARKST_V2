# How to safely modify ARKST

Start with the **workflow**, not with the file you first notice. For example, if
you want to change an NPTEL deadline form, follow the faculty component, API
route, input validator, data function and SQL window rule before editing. Use
[the file index](FILE_INDEX.md) to find each file's explanation and original path.

## A small change workflow

1. Run `git status --short --branch` and read the latest [project status](../PROJECT_STATUS.md). Preserve existing uncommitted work. Confirm the branch and migration head before editing.
2. State the real user behavior you want. Identify who may perform it, on which students, and what database record must change.
3. Inspect the screen, route, `src/auth/` request boundary, `src/core/` validator, `src/data/` call and relevant SQL/RLS. Existing tests are useful evidence, but read the code too.
4. Make the smallest forward change. For an already-applied database schema or SQL function, add a **new migration**; never rewrite the old one. Keep actor/time audit and transaction rollback.
5. Test success, denied scope, duplicate request, invalid input and a real failure path. Run `npm run check` for code quality, `npm run test:rls` for SQL security, and the relevant `npm run test:local -- identity|activity|directory|operations|push|workflows|session2|session3` suite against the isolated local stack. Run the full suite when a shared boundary changes.
6. Inspect `git diff --check` and the actual diff. Confirm that only intended files changed and that no local `.env` or credentials entered Git.
7. Report exactly what passed, failed or remained unverified. A passing build cannot prove RLS, Google OAuth, Windows push or hosted scheduling.

## Permission questions to ask

- Is this only a UI preference, or a trusted grant? Staff designation and selected sections do **not** create authority.
- Is the caller's active Auth user checked? Do the Auth UUID and active profile agree?
- Does this operation need CREATE, READ, VERIFY, counselor mapping, calendar/group management or supervision? These are separate.
- Does SQL check every target section/student now, rather than trusting values sent by the browser?
- Does an inactive student or ended responsibility lose ordinary _current_ access while historical records remain?
- Does a failed history or notification insert roll back the parent action?

## Safe operational boundaries

Never put service-role, owner database, scheduler password or VAPID private keys in
browser code or a `NEXT_PUBLIC_*` variable. [Trusted operator commands](../../scripts/directory-admin.mjs)
preview by default and require an approved exact-department administrator;
production use needs separate credential custody and review. Never run local
integration tests against a remote project or reset a populated database to make
a test pass.

Google OAuth application code is prepared but needs approved external credentials
and real sign-in tests. Systemd timer examples need deployment and monitoring.
Provider push acceptance is not proof of desktop display. See
[release operations](../RELEASE_OPERATIONS.md) and
[Go-account handoff](../GO_ACCOUNT_HANDOFF.md) for these outstanding steps.
