# `src/data/department-operations.ts`

[Open the original file](../../../../../src/data/department-operations.ts) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

A server-only data access module for section publication, announcements and monitoring.

## B. Why does ARKST need it?

It supports section publication, announcements and monitoring. A programmer uses it to operate or maintain the same college application safely.

## C. How does it work?

It uses the authenticated Supabase client to query RLS-protected tables or call named SQL functions; the browser never receives an owner database key. Named declarations include `departmentRpc`. Imported helpers called here: `ActivityError`. `departmentRpc` is the common bridge to group, calendar, follow-up and supervision RPCs. It maps PostgreSQL permission, duplicate, invalid-input and service errors to public HTTP errors without logging private data.

## D. Which files does it connect to?

- [`src/core/activity-input.ts`](../../../../../src/core/activity-input.ts) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The connected modules listed below may need review and focused regression checks.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- operations` against the existing isolated local stack if this workflow changed.

## G. Important cautions

Keep same-origin mutation checks, bounded input and caller-session RLS. A UI filter is not an authorization boundary.
