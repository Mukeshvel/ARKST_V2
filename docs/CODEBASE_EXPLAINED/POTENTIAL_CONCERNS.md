# Observed limits and review points

These are review observations, updated for the focused Activity-supervision correction. External deployment evidence remains separate from local tests.

1. **Selected-Activity counselor reporting added.** The separate `supervisory_activity_overview` RPC and UI now implement this earlier gap while preserving the all-activities overview. Current grants and active mappings control access; see PROJECT_STATUS.md for verification evidence.
2. **Some staff navigation links appear before grant checks.** [Dashboard navigation](../../src/app/dashboard/dashboard-nav.tsx) links staff to Groups, Calendar and Overview. Each destination's API/SQL still requires the separate group, calendar or supervision grant; a staff member without one may see a link and then receive a denial. This is a usability issue, not evidence of permission escalation.
3. **External operation is unverified.** The Google start/callback code, hosted calendar runner, push dispatcher and systemd examples require institution-approved provider credentials, host, secret custody and real observation. Existing local PKCE/dispatcher tests cannot prove hosted OAuth, a Windows popup with the tab closed, or timer recovery.
4. **Real-data authorization needs approved setup.** The operator CLI links existing confirmed Auth accounts and trusted roster/role records. Initial HOD/admin bootstrap, official college records, counselor allocations and institutional sign-off are outside the repository's synthetic local fixtures.

See [release operations](../RELEASE_OPERATIONS.md) for the manual configuration
boundary. Do not treat these notes as permission to weaken RLS or bypass the
trusted provisioning workflow.
