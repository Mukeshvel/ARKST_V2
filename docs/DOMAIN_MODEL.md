# Domain model

## Milestone 2 identity schema

The versioned SQL migration defines the following tables. It has not been applied or
executed against a real database here because local prerequisites are unavailable.

| Table                        | Relationships and constraints                                                                                                                                                                                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`                   | Primary key references `auth.users.id` with cascading deletion. Display name, one account kind (`student`/`staff`), optional staff employment classification, active flag (default false), creation time. Staff must have teaching/non-teaching classification; students must not. |
| `scopes`                     | UUID, name, kind (`institution`, `department`, `section`, `group`), optional parent and creation time. Exact boundaries only; no group membership or permission inheritance.                                                                                                       |
| `responsibility_assignments` | Many per staff profile, each with role, scope, start/end instants and creation time. Composite foreign key prevents assigning staff responsibilities to students. Multiple simultaneous roles are allowed.                                                                         |

Identity uses the provider-independent Supabase Auth UUID. Auth account existence does
not imply application access. There is no automatic profile creation or metadata-based
role grant. A missing profile is unprovisioned; an existing profile with `is_active=false`
is inactive. RLS hides both, so the application deliberately returns a combined denial.
Responsibility names are teacher, counselor, coordinator, placement coordinator, branch
coordinator, HOD and admin. Classification is separate from these responsibilities.

Responsibility intervals are start-inclusive/end-exclusive, with null end meaning no
scheduled end. The schema does not yet record a grantor/audit event, student scope
membership, or dual student/staff status. Parent links do not validate arbitrary long
cycles or parent-kind relationships; no traversal uses them in this milestone.

## Proposed academic model — not implemented

The table below preserves the broader design. Identity proposals are partly realized
above; all academic entities/workflows, richer organization structure and audit history
remain proposals. IDs are server-generated; timestamps are UTC instants.

| Entity                   | Relationships and purpose                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| UserProfile              | One verified Auth user; active/disabled state; student/staff classification.                                             |
| StaffProfile             | User extension with teaching/non-teaching employment classification; no implicit permissions.                            |
| OrganizationUnit         | Institution → branch → section/cohort hierarchy; exact hierarchy provisional.                                            |
| ResponsibilityAssignment | Many per staff user; role, organization/group scope, validity period and grantor.                                        |
| Group                    | Named static membership or approved dynamic selection rule within an organization scope.                                 |
| GroupMembership          | User/group link with effective start/end and history; derived membership recorded for dynamic rules.                     |
| ActivityCategory         | Shared configurable categories: assignment, aptitude/coding test, NPTEL, seminar, mini project, placement, general task. |
| Activity                 | Category, title, description, owner, scope, draft/published state and verification requirement.                          |
| ActivityTarget           | Activity → authorized group or individual recipients; union deduplicated on publication.                                 |
| ScheduleDefinition       | Configurable timezone, recurrence, count and windows; yields explicit activity occurrences.                              |
| ActivityOccurrence       | Activity + concrete opening/deadline instants; unique occurrence key.                                                    |
| Assignment               | Occurrence + student, unique pair; records eligibility source and publication snapshot.                                  |
| CompletionReport         | Assignment, authenticated reporter, submitted time, optional evidence and version.                                       |
| Verification             | Report, authorized reviewer, decision, reason and time; cannot be student self-verification.                             |
| Announcement             | Author, scope, content, publish time and recipients; no notification delivery implied.                                   |
| AuditEvent               | Actor, action, resource, timestamp and minimal change details; durable restricted history.                               |

## Dynamic groups and targeting

Recommendation (provisional): allowlisted structured predicates such as branch, cohort
and counselor assignment; never arbitrary SQL or client-authored executable predicates.
Evaluate membership server-side. Preview recipient count only within authorized scope.
On publication, snapshot recipients into unique assignments so membership changes do
not silently erase obligations or history. Joining/leaving groups affects future
publications. Retroactive additions/removals require an explicit audited action.
Confirm this policy before implementation.

## Scheduling and completion

Five aptitude/coding tests per week is an editable scheduling configuration, not five
hardcoded dates. Model recurrence separately from concrete occurrences. Store an IANA
timezone with rules; materialize UTC windows with explicit DST ambiguity handling.
Holiday handling, makeup windows and recurrence changes require college decisions.

Implemented provisional rule: opensAt ≤ now < dueAt is open; equal/reversed windows
and invalid instants are rejected. The function classifies a window, not permission
to submit. Late submission policy is undecided. Pass server time in future workflows.

Implemented accounting: pending is incomplete; reported is complete only if verification
is not required; verified is complete. These functions do not authorize transitions.
Planned transitions: pending → reported by the assigned student, reported → verified
or returned with reason by an authorized reviewer. Returned work, resubmission,
evidence requirements and changes to verification policy need approved semantics.
Monitoring should separate not reported, awaiting review and verified so students
awaiting review are not misleadingly labeled as having submitted nothing.

Announcements use the same scoped audience concepts. Follow-up history and future
escalations reference assignments, rather than independent per-category databases.
