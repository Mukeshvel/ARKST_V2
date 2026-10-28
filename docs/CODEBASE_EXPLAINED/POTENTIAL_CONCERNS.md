# Observed limits and review points

This is a documentation-only review. These are **not** claims that a local test
failed, and no code was changed to address them.

1. **No per-Activity counselor breakdown for the HOD.** [Supervision input](../../src/core/calendar-input.ts) and [the current overview RPC](../../supabase/migrations/20261028002200_supervisor_department_scope.sql) accept a department and optional section, not an Activity ID. The [supervision page](../../src/app/dashboard/supervision/supervision-board.tsx) shows counselor aggregates across authorized department work. A creator and each counselor have their own Activity views, but a HOD cannot read a counselor-wise NPTEL-only summary from that overview as currently written.
2. **Some staff navigation links appear before grant checks.** [Dashboard navigation](../../src/app/dashboard/dashboard-nav.tsx) links staff to Groups, Calendar and Overview. Each destination's API/SQL still requires the separate group, calendar or supervision grant; a staff member without one may see a link and then receive a denial. This is a usability issue, not evidence of permission escalation.
3. **External operation is unverified.** The Google start/callback code, hosted calendar runner, push dispatcher and systemd examples require institution-approved provider credentials, host, secret custody and real observation. Existing local PKCE/dispatcher tests cannot prove hosted OAuth, a Windows popup with the tab closed, or timer recovery.
4. **Real-data authorization needs approved setup.** The operator CLI links existing confirmed Auth accounts and trusted roster/role records. Initial HOD/admin bootstrap, official college records, counselor allocations and institutional sign-off are outside the repository's synthetic local fixtures.

See [release operations](../RELEASE_OPERATIONS.md) for the manual configuration
boundary. Do not treat these notes as permission to weaken RLS or bypass the
trusted provisioning workflow.
