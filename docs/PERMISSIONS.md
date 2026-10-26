# Permissions

## Milestone 2 enforcement implemented in code and SQL

The migration has not been applied or tested against PostgreSQL in this environment.
These are the implemented rules to verify, not a claim of validated production security.

| Caller                                   | Current access                                                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Anonymous                                | No private table grants; protected API rejects missing identity.                                                                |
| Active provisioned student               | Read own private profile only. No staff responsibilities or scope directory access.                                             |
| Active provisioned staff                 | Read own profile, own current responsibilities and the exact scopes those responsibilities reference.                           |
| Inactive or unprovisioned Auth user      | No private profile, responsibilities or scopes. Application reports a combined not-provisioned-or-inactive denial.              |
| Staff with any role, including admin/HOD | Same own-data limits. No automatic student access, hierarchy inheritance or administrative bypass.                              |
| Trusted operator                         | Explicit out-of-band provisioning using protected administrative/database credentials; no application role-management endpoint. |

Every application profile read derives the ID from server-verified `getClaims` and
`getUser`, not a request parameter or client-selected identity. The API does not offer
an arbitrary-user lookup. PostgreSQL RLS independently restricts row visibility, including
direct Data API access. Authenticated clients have SELECT grants only; INSERT, UPDATE
and DELETE are revoked and there are no write policies or privileged RPCs.

Teaching/non-teaching classification grants nothing. Roles are separate responsibility
rows with an exact scope and validity interval. A composite foreign key permits staff
responsibilities only for staff profiles. One user can simultaneously hold teacher,
counselor and placement coordinator responsibilities. Expired or future responsibilities
are excluded by RLS; records are read fresh rather than trusted from client metadata.

Scope records include institution, department, section and group kinds. Parent links
are structural placeholders only: **no inherited scope permissions are implemented**.
The schema prevents self-parenting but does not validate all longer cycles or parent-kind
relationships. Add those constraints before any traversal or inheritance workflow.
Students' group membership and academic access are not implemented.

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

## Future academic policy — provisional and not implemented

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

Automated pgTAP policy tests and genuine local Auth/HTTP/REST integration tests are
authored, but real execution is blocked by unavailable Docker/Supabase/PostgreSQL tools.
The tests distinguish SQL role contexts from genuine Auth login. Verify anonymous
denial, cross-user isolation, role mutation denial, inactive/unprovisioned denial,
malformed sessions, logout and visible database failures before using real student data.
