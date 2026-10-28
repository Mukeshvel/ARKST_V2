# `src/data/activities.ts`

[Open the original file](../../../../../src/data/activities.ts) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

A server-only data access module for one shared Activity, assignment and completion model.

## B. Why does ARKST need it?

It supports one shared Activity, assignment and completion model. A teacher assigns NPTEL work and assigned students report external completion.

## C. How does it work?

It uses the authenticated Supabase client to query RLS-protected tables or call named SQL functions; the browser never receives an owner database key. Named declarations include `result`, `code`, `selection`, `listActivities`, `activities`, `summarySelection` and others. Supabase RPCs named here: `create_activity`, `create_section_activity`, `monitor_created_activity`, `monitor_counselor_activities`, `activity_creation_options`, `eligible_activity_students`. Imported helpers called here: `ActivityError`. Read helpers query caller-visible Activity rows. Write helpers invoke transactional SQL RPCs such as `create_section_activity`, `create_selected_activity`, `submit_activity` and `verify_activity`; SQL error codes become 400/403/409/503 rather than false success. Page sizes are bounded.

## D. Which files does it connect to?

- [`src/core/activity-input.ts`](../../../../../src/core/activity-input.ts) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The connected modules listed below may need review and focused regression checks.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- activity` against the existing isolated local stack if this workflow changed.

## G. Important cautions

Keep same-origin mutation checks, bounded input and caller-session RLS. A UI filter is not an authorization boundary.
