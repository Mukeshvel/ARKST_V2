# Permissions

## Completion Sprint Session 1 workflow boundaries

Follow-up authority requires a current mapped counselor relationship or the
Activity creator's continuing category CREATE authority for the student's current
section and original target. It does not confer verification or unrelated roster
reads. Attention uses the same scoped assignments. A student can escalate only their
own pending assignment to a current counselor. Staff escalation uses a trusted
per-section `escalation_routes` row tied to an active matching responsibility;
designation text and profile preferences are ignored. Old recipients lose ordinary
case access when their mapping or route ceases to be current. Catch-up review and
publication require explicit `general` CREATE approval for the active student's
current section. A current counselor may see the student's request without gaining
publication authority. Direct writes to workflow tables and route configuration are
revoked from ordinary clients. See [WORKFLOWS.md](WORKFLOWS.md).

## Milestone 2 enforcement implemented in code and SQL

Identity rules below were verified locally in Milestone 2.1 and regressed in 3A.
Activity access is additive and explicitly provisioned, as described below.

| Caller                                   | Current access                                                                                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Anonymous                                | No private table grants; protected API rejects missing identity.                                                                      |
| Active provisioned student               | Read own private profile only. No staff responsibilities or scope directory access.                                                   |
| Active provisioned staff                 | Read own profile, own current responsibilities and exact referenced scopes; counselor roster rows only via current approved mappings. |
| Inactive or unprovisioned Auth user      | No private profile, responsibilities or scopes. Application reports a combined not-provisioned-or-inactive denial.                    |
| Staff with any role, including admin/HOD | Same own-data limits. No automatic student access, hierarchy inheritance or administrative bypass.                                    |
| Trusted operator                         | Explicit out-of-band provisioning using protected administrative/database credentials; no application role-management endpoint.       |

Every application profile read derives the ID from server-verified `getClaims` and
`getUser`, not a request parameter or client-selected identity. The API does not offer
an arbitrary-user lookup. PostgreSQL RLS independently restricts row visibility, including
direct Data API access. On identity tables, authenticated clients have SELECT grants
only; INSERT, UPDATE and DELETE remain revoked. Activity mutation RPCs do not grant
any ability to change profiles, scopes or responsibility assignments.

Teaching/non-teaching classification grants nothing. Roles are separate responsibility
rows with an exact scope and validity interval. A composite foreign key permits staff
responsibilities only for staff profiles. One user can simultaneously hold teacher,
counselor and placement coordinator responsibilities. Expired or future responsibilities
are excluded by RLS; records are read fresh rather than trusted from client metadata.

Scope records include institution, department, section and group kinds. Parent links
are structural placeholders only: **no inherited scope permissions are implemented**.
The schema prevents self-parenting but does not validate all longer cycles or parent-kind
relationships. Add those constraints before any traversal or inheritance workflow.
Students' group membership is not implemented. The new student_scope_memberships table
records operator-approved exact department/section membership for direct targeting.

Signup never provisions a profile or assigns a role. There is no auth-user trigger,
browser role selector, self-promotion endpoint, or email-domain-to-role mapping.
Creating an Auth user and provisioning approved application records are separate
trusted operator actions. Administrative credential possession is privileged; keep it
outside the application, browser, repository and ordinary development logs.

## Session and request boundaries

Local password login requires explicit local configuration and loopback origins. Hosted
onboarding and Google OAuth are disabled. Authentication mutations require exact Origin,
reject cross-site requests, and accept no privileged input. Login forms have a byte limit.
Cookies are HttpOnly/SameSite=Lax and Secure under HTTPS; private responses are no-store.
Proxy refresh is not sufficient authorization; each protected entry point verifies identity.

Normal logout clears application cookies and requests current-session refresh-token
revocation. Copied access tokens may remain valid until their expiration (900 seconds
in local config). Logout errors visibly distinguish local clearing from unconfirmed
remote revocation. Immediate replay revocation is not implemented.

The API uses 401/403/503 status codes; the HTML page can render a denial/service error
with HTTP 200, but includes no profile data on those paths. Unit tests and config-free
smoke checks do not prove database isolation or successful authenticated flows.

## Milestone 3A Activity permissions

No role name automatically grants creation, reading or verification. A trusted operator
must approve a row in activity_capabilities for a specific responsibility_id/category_key,
with can_create and/or can_verify. Both default false. An expired/future responsibility,
inactive profile, wrong scope or wrong category denies access even if another role is valid.
The app has no capability/membership provisioning endpoint. The tests provision only
temporary fixtures; no standing staff grants were seeded by the migration.

- An active student can read only assigned activities and their own assignment,
  completion and assignment events. They can report only their own pending assignment
  during the configured submission window, and cannot verify or browse other students.
- A staff member with a current create capability may create within that exact scope
  and category only after every active student has a current exact-scope membership.
- For original direct-target Activities, a staff member with either create or verify
  capability can read Activity assignments/completions within that exact scope/category.
  Section-snapshot Activities narrow this: the creator may monitor their own Activity
  while current CREATE approval covers every selected section; an independent exact-scope
  VERIFY approval retains review/read access. No CREATE grant opens an unrelated
  section-snapshot Activity or an unassigned roster. Creator access ends after revocation.
- A verify capability permits reported → verified only when verification is required.
  Create capability alone is insufficient. No pending → verified or self-review exists.
- Staff with only counselor/HOD/admin or another role name have no Activity authority.
  Capabilities are never combined across responsibility scopes or categories.

Direct client writes to the Activity and selected-section tables are revoked. The mutation RPCs
perform authorization explicitly and save history atomically. Read RLS still applies
to direct REST queries. Privileged database owners/service-role operators can bypass
these boundaries; audit history is append-only for application users, not tamper-proof
against database administrators. Operator provisioning audit tooling remains future work.

Membership is checked at publication; existing assignments are durable after membership
expiry. Current staff capability controls staff reads; profile activation controls all
student reads. No hierarchy inheritance or group expansion is implemented.

See [ACTIVITY_ENGINE](ACTIVITY_ENGINE.md) for examples, API errors and remaining limits.

## Milestone 3B-1 directory boundaries

An approved active department responsibility can read and update only that staff
member's editable directory profile. Teaching status, section preferences, subjects
and free-text designation do not grant roles, capabilities, counselor authority or
access to other profiles. The editor accepts no role/capability fields. Student callers
cannot update staff data, and staff cannot edit another staff member's directory record.

Department-scoped Activity creation capabilities may target their direct child sections
(including Section A, B or both) after trusted provisioning; this is independent of a
staff member's teaching status or self-edited preferred sections. READ and VERIFY retain
the committed 3A exact-scope rule and are not inherited by child sections from a
department create grant. A create grant gives no general roster browsing. Approved
current counselor-student mappings, an active roster row, active staff profile and a
current counselor responsibility are required for ordinary counselor monitoring. Ended
mappings remain in history but do not grant current RLS access. Mapping data is separate from self-service
and cannot be modified through the faculty profile API. Counselor results omit email.

Staff provisioning and CSV imports are out-of-band operator actions. Email confirmation
alone is insufficient. The local operator CLI requires a current admin responsibility
for the exact department and a loopback database URL, but uses a database-owner connection
for transactions; the database owner remains trusted and can bypass RLS. Keep that
credential protected. HOD/Admin policy is still controlled separately; no HOD privilege
is inferred from a designation string. See [DEPARTMENT_DIRECTORY](DEPARTMENT_DIRECTORY.md).

## Milestone 3B-2A monitoring boundary

The section publication RPC accepts only a department and selected direct child
sections, then snapshots eligible active linked roster students with current section
membership into the existing assignment table. The monitor for its creator returns
only that Activity's assigned students and states, with bounded pagination. A counselor
monitor uses administrator-managed current counselor mappings and active roster rows to
show only that counselor's students' assigned Activities, regardless of creator. This
mapping does not grant broad Activity READ, CREATE or VERIFY. Student submissions and
reviewer verification retain the 3A authorization and unique completion record.

The 3B-2B creation-options RPC shows only section/category combinations for which
the current caller passes CREATE and returns aggregate eligible counts. A form option
is never an authorization token; the publication RPC rechecks every scope and student.
Dashboard navigation may show faculty and counselor links for one staff account, but
all data requests still pass the existing server session checks and RLS or scoped RPCs.
The faculty result screen is read only, including for a creator without VERIFY.

## Milestone 4 targeting, announcement and inbox boundary

Selected-student candidate search returns only names, roll identifiers and
sections of active linked roster students in the caller's current category
CREATE scope. It does not expose email or unrelated private records. Publishing
rechecks every selected student; counseling mode also requires each current
trusted counselor mapping. A counselor role by itself grants no CREATE,
department-wide targeting, general roster read or VERIFY. Creator monitoring
still requires current authority, while counselor results include only current
mapped active students regardless of creator.

Announcements require an explicit `general` category CREATE capability for
every selected section. Their recipients are active, linked, currently
eligible roster students. The message creates no Activity assignment or
pending completion. Recipient snapshots and notification rows are immutable to
ordinary clients; creator/recipient announcement SELECT and own-notification
SELECT are protected by RLS. A notification can be marked read only by its
active recipient through a same-origin, session-checked RPC. The authenticated
client has no direct INSERT/UPDATE/DELETE grant on those tables or access to
the private outbox.

Notification/outbox inserts occur in the same transaction as Activity or
announcement publication. A failure rolls back the whole publication. The
unique `(recipient_id, source_kind, source_id)` key prevents duplicate inbox
records for repeated processing of the same source. At Milestone 4 desktop
push had no worker; Milestone 5 adds one without changing publication scope.
A database owner remains a trusted privileged operator outside RLS.

## Milestone 5 push boundary

Only an active authenticated account can register, check or disable its own
browser subscription through caller-scoped RPCs. Cross-account endpoint
registration is rejected, and ordinary users have no table grants on stored
endpoints, encryption keys, per-device outcomes or outbox claims. Registration
is bounded at ten active devices per account under a profile-row lock. The
public VAPID key alone is sent to browsers; private VAPID and database secrets
remain in a trusted Node process. The dispatcher consumes exact notification
recipients rather than recomputing audience from a profile or client IDs.
It validates each stored endpoint against known HTTPS provider hosts before
network access. Push previews require the current signed-in recipient's RLS
read; a notification link alone never grants access. A disabled or switched
account may still have an already in-flight provider request, but the service
worker cannot show another account's private preview.

## Session 2 operation boundaries

Session 2 uses explicit `department_operation_capabilities` rows attached to a
current exact-department staff responsibility. The three independent flags are
`can_manage_groups`, `can_manage_calendar` and `can_supervise`. An approved admin
provisions/revokes them through the trusted local preview/transactional CLI; changes
are audited in `department_operation_grant_history`. None is inferred from role name,
profile teaching status, section preference, designation, email or another flag.

Group management may list the department's eligible roster and current/historical
group members. It does not grant publication by itself: the existing category CREATE
predicate must authorize every current target section. Group publication does not
grant Activity READ/VERIFY or counselor private-student access. Calendar management
permits configuration and invoking the runner; generation separately requires current
`weekly_test` CREATE for every selected section. Only the original creator with
current category CREATE for all target sections can change an Activity deadline.
The runner and blackout writes serialize by department; counselor mapping mutations
serialize before the original non-overlap exclusion constraint.

Supervision is a separate trusted private-roster grant. Its RPC checks the exact
department and any requested child section, then returns bounded detail and complete
current-scope counts. Assignment and case counts require Activity origin in the
granted department, and the per-student detail RPC additionally requires an active
roster entry. Department CREATE, group management and calendar management do
not imply private supervisory reads. The current counselor view still requires the
administrator-created effective-dated counselor mapping; editable staff fields never
change it. Direct authenticated writes and direct reads of the new configuration,
membership history, occurrence and grant tables are revoked, with RLS enabled.

The provisional table below describes possible future college policy. It does not
auto-provision the Session 2 flags or alter the current explicit grants.

## Future role-to-capability policy — provisional and not implemented

| Responsibility        | Proposed capability and scope                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------- |
| Student               | Read own applicable activities/announcements and report own assignments. No roster browsing, review or grants. |
| Teacher               | Create/monitor/review for explicitly assigned teaching groups.                                                 |
| Counselor             | Monitor/follow up assigned advisees; creation/review only with an explicit approved capability.                |
| Coordinator           | Create/monitor/review and announce within assigned program/group scope.                                        |
| Placement Coordinator | Placement activities/announcements within assigned placement scope.                                            |
| Branch Coordinator    | Assigned branch activities, monitoring and announcements.                                                      |
| HOD                   | Assigned branch oversight; delegation requires a separate grant.                                               |
| Admin                 | Explicit organization-scoped account/role administration; no global bypass or automatic academic review.       |

Publication must authorize every target and category, not merely draft ownership.
Review requires authority over both assignment and student, with no self-review.
Never combine a role from one assignment with another assignment's scope. If hierarchy
inheritance is later approved, make it explicit, acyclic and bounded. Dual student/staff
status requires a future data-model decision; the current profile has one account kind.

Future administrative delegation needs a capability ceiling, no self-promotion, and
audited role/scope changes. The current schema has no administrative audit workflow.
Retention, evidence access, exports, consent and break-glass access remain undecided.

## Verification required

Automated pgTAP and genuine local Auth/HTTP/REST integration tests have been executed.
The tests distinguish SQL role contexts from genuine Auth login. See PROJECT_STATUS
for counts, commands and failures. These local results do not establish production
readiness or approve the future college role-to-capability policy above.
