# Domain model

## Milestone 2 identity schema

The versioned identity migration defines the following locally verified tables.

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
scheduled end. The identity schema does not yet record a grantor/audit event or dual
student/staff status. Milestone 3A adds exact student scope membership. Parent links do not validate arbitrary long
cycles or parent-kind relationships; no traversal uses them in this milestone.

## Milestone 3A shared Activity schema

Seven tables are implemented by 20261027000100_activity_engine.sql:

| Table                     | Purpose                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| activity_categories       | Extensible category keys; seven initial categories, no per-category workflow tables.                                                       |
| student_scope_memberships | Trusted, dated student membership used for exact department/section targeting.                                                             |
| activity_capabilities     | Explicit create/verify approval attached to one existing responsibility and category.                                                      |
| activities                | One concrete scheduled activity with title, description, scope, category, start/deadline/end, verification flag and authenticated creator. |
| activity_assignments      | Durable direct target; unique activity/student pair, actor and assignment timestamp.                                                       |
| activity_completions      | Zero or one per assignment; absence is pending, then reported, optionally verified with a distinct actor/time.                             |
| activity_history          | Transactional created/assigned/reported/verified events; actor, server time and references.                                                |

There is no draft/edit/cancel flow. Creation publishes all direct assignments atomically.
Each Activity is a concrete occurrence; future schedule generation can create these same
rows with a schedule reference. No fixed weekly test count, recurrence generator or
group-membership evaluator exists. The assignment ID remains suitable for future
follow-up, notification and catch-up references. Current requests support 1–500 unique
students as a technical bound, and list/history reads use 50-row pages.

The existing completion accounting is preserved: reported is complete only when
verification is not required; verified is complete. Submission never sets verified.
Both submission and review lock the assignment. No resubmission/rejection/reopening
transition is currently supported. See [ACTIVITY_ENGINE](ACTIVITY_ENGINE.md).

## Broader proposed academic model

The table below preserves the broader design. Identity proposals are partly realized
above. The shared Activity/assignment/completion/history subset is now implemented as
described above; groups, recurring schedules, announcements and broader governance
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
to submit. The Activity RPC enforces this boundary with database transaction time.
An explicit end must be at or after the deadline; an end after the deadline does not
enable late submission. Late submission policy remains undecided.

Implemented accounting: pending is incomplete; reported is complete only if verification
is not required; verified is complete. These functions do not authorize transitions.
Planned transitions: pending → reported by the assigned student, reported → verified
or returned with reason by an authorized reviewer. Returned work, resubmission,
evidence requirements and changes to verification policy need approved semantics.
Monitoring should separate not reported, awaiting review and verified so students
awaiting review are not misleadingly labeled as having submitted nothing.

Announcements use the same scoped audience concepts. Follow-up history and future
escalations reference assignments, rather than independent per-category databases.
