# `src/app/api/activities/[id]/window/route.ts`

[Open the original file](../../../../../../../../../src/app/api/activities/[id]/window/route.ts) · [Back to file index](../../../../../../../FILE_INDEX.md)

## A. What is this file?

The `POST` handler for `/api/activities/[id]/window`.

## B. Why does ARKST need it?

It supports one shared Activity, assignment and completion model. A teacher assigns NPTEL work and assigned students report external completion.

## C. How does it work?

It receives a browser request, validates or delegates it, and returns a response for one shared Activity, assignment and completion model. It delegates data work to imported data or validation helpers. HTTP methods: POST. Named declarations include `dynamic`, `POST`. Imported helpers called here: `activityRequest`, `readActivityJson`, `activityId`, `windowInput`, `departmentRpc`.

## D. Which files does it connect to?

- [`src/auth/activity-http.ts`](../../../../../../../../../src/auth/activity-http.ts) — a real imported or workflow-related file.
- [`src/core/activity-input.ts`](../../../../../../../../../src/core/activity-input.ts) — a real imported or workflow-related file.
- [`src/core/calendar-input.ts`](../../../../../../../../../src/core/calendar-input.ts) — a real imported or workflow-related file.
- [`src/data/department-operations.ts`](../../../../../../../../../src/data/department-operations.ts) — a real imported or workflow-related file.

## E. What happens if I modify this file?

Callers of this endpoint, input validation and the downstream SQL policy may all be affected. Recheck success and denied roles.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- activity` against the existing isolated local stack if this workflow changed.

## G. Important cautions

Keep same-origin mutation checks, bounded input and caller-session RLS. A UI filter is not an authorization boundary.
