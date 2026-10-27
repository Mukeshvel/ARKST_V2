# Permissions

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
