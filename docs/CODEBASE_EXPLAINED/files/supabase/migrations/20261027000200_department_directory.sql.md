# `supabase/migrations/20261027000200_department_directory.sql`

[Open the original file](../../../../../supabase/migrations/20261027000200_department_directory.sql) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

A forward-only PostgreSQL migration for staff profiles, roster data and trusted mappings.

## B. Why does ARKST need it?

It supports staff profiles, roster data and trusted mappings. An administrator imports approved names and sections, then links them to existing confirmed accounts.

## C. How does it work?

It changes database objects in version order. Identified objects: table: `department_student_roster`, `counselor_student_mappings`, `staff_directory_profiles`, `staff_section_preferences` (plus 1 more); function: `valid_subjects`, `can_self_edit_staff`, `can_see_roster`, `can_manage` (plus 2 more); policy: `roster_scoped_read`, `own_counselor_mappings`, `own_staff_directory`, `own_staff_preferences` (plus 1 more); index: `department_roster_section_idx`, `counselor_mappings_responsibility_idx`, `directory_audit_actor_idx`, `directory_audit_entity_idx`. The SQL is applied or asserted by the local Supabase CLI. Review the exact DDL/RLS/SQL assertions in the original file. The roster stores external identifiers and exact sections. Counselor mappings connect roster students to approved counselor responsibilities, while staff directory fields remain self-editable descriptions. These profile fields do not grant private counselor access.

## D. Which files does it connect to?

- [`supabase/config.toml`](../../../../../supabase/config.toml) — a real imported or workflow-related file.
- [`supabase/tests/database/directory_security.test.sql`](../../../../../supabase/tests/database/directory_security.test.sql) — a real imported or workflow-related file.

## E. What happens if I modify this file?

Changing it after application would make database history disagree with Git. Use a new migration and rerun RLS/integration checks.

## F. How do I verify a safe change?

In the isolated local stack, confirm migration history, then run `npm run test:rls` and `npm run test:local`. Never reset a populated database just to test a migration.

## G. Important cautions

Already-applied migrations are historical records: add a new forward migration. Check RLS, grants, `SECURITY DEFINER` search paths and rollback behavior in a disposable environment.
