# `supabase/migrations/20261027000900_announcements_notifications.sql`

[Open the original file](../../../../../supabase/migrations/20261027000900_announcements_notifications.sql) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

A forward-only PostgreSQL migration for the recipient inbox, unread state and delivery outbox.

## B. Why does ARKST need it?

It supports the recipient inbox, unread state and delivery outbox. A newly assigned student gets an inbox entry; an opted-in browser may also receive a dispatched desktop push.

## C. How does it work?

It changes database objects in version order. Identified objects: table: `announcements`, `announcement_target_sections`, `announcement_recipients`, `notifications` (plus 1 more); function: `enqueue_notification`, `notify_activity_assignment`, `notify_announcement_recipient`, `publish_announcement` (plus 1 more); policy: `own_announcement_recipients`, `announcements_visible`, `own_notifications`; trigger: `notification_outbox_insert`, `activity_assignment_notification`, `announcement_recipient_notification`; index: `announcement_recipient_student_idx`, `notifications_recipient_created_idx`. The SQL is applied or asserted by the local Supabase CLI. Review the exact DDL/RLS/SQL assertions in the original file. Announcements are informational; they create recipients and inbox/outbox notices but no completion obligation. Database triggers and RPC checks keep publication and notifications in the same transaction.

## D. Which files does it connect to?

- [`supabase/config.toml`](../../../../../supabase/config.toml) — a real imported or workflow-related file.
- [`supabase/tests/database/push_security.test.sql`](../../../../../supabase/tests/database/push_security.test.sql) — a real imported or workflow-related file.

## E. What happens if I modify this file?

Changing it after application would make database history disagree with Git. Use a new migration and rerun RLS/integration checks.

## F. How do I verify a safe change?

In the isolated local stack, confirm migration history, then run `npm run test:rls` and `npm run test:local`. Never reset a populated database just to test a migration.

## G. Important cautions

Already-applied migrations are historical records: add a new forward migration. Check RLS, grants, `SECURITY DEFINER` search paths and rollback behavior in a disposable environment.
