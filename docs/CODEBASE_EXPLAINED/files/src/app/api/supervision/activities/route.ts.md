# `src/app/api/supervision/activities/route.ts`

[Source](../../../../../../../../src/app/api/supervision/activities/route.ts)

## A. What is this file?

Authenticated GET endpoint for Activity choices and selected results.

## B. Why does ARKST need it?

Supplies the HOD Activity selector and counselor table.

## C. How does it work?

activityRequest enforces the existing authenticated request boundary. supervisionActivityQuery validates department, section, Activity UUID and offset. departmentRpc calls supervisory_activity_overview and converts database errors into the existing HTTP error responses.

## D. Which files does it connect to?

- [`src/auth/activity-http.ts`](../../../../../../../../src/auth/activity-http.ts)
- [`src/core/calendar-input.ts`](../../../../../../../../src/core/calendar-input.ts)
- [`src/data/department-operations.ts`](../../../../../../../../src/data/department-operations.ts)
- [`supabase/migrations/20261028002500_activity_supervision.sql`](../../../../../../../../supabase/migrations/20261028002500_activity_supervision.sql)

## E. What happens if I modify this file?

Changing parameters affects the UI and RPC together; preserve the separate all-activities endpoint.

## F. How do I verify a safe change?

npm run check; local Session 2 integration suite.

## G. Important cautions

Never substitute service-role access for the caller session; SQL checks the supervision grant.
