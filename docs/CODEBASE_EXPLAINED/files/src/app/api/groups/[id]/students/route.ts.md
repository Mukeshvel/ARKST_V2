# `src/app/api/groups/[id]/students/route.ts`

[Open the original file](../../../../../../../../../src/app/api/groups/[id]/students/route.ts) · [Back to file index](../../../../../../../FILE_INDEX.md)

## A. What is this file?

The `GET` handler for `/api/groups/[id]/students`.

## B. Why does ARKST need it?

It supports named student groups and publication snapshots. A placement group is edited without rewriting already published student assignments.

## C. How does it work?

It receives a browser request, validates or delegates it, and returns a response for named student groups and publication snapshots. It delegates data work to imported data or validation helpers. HTTP methods: GET. Named declarations include `dynamic`, `GET`. Imported helpers called here: `activityRequest`, `activityId`, `groupStudentQuery`, `departmentRpc`.

## D. Which files does it connect to?

- [`src/auth/activity-http.ts`](../../../../../../../../../src/auth/activity-http.ts) — a real imported or workflow-related file.
- [`src/core/activity-input.ts`](../../../../../../../../../src/core/activity-input.ts) — a real imported or workflow-related file.
- [`src/data/department-operations.ts`](../../../../../../../../../src/data/department-operations.ts) — a real imported or workflow-related file.

## E. What happens if I modify this file?

Callers of this endpoint, input validation and the downstream SQL policy may all be affected. Recheck success and denied roles.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- session2` against the existing isolated local stack if this workflow changed.

## G. Important cautions

Keep same-origin mutation checks, bounded input and caller-session RLS. A UI filter is not an authorization boundary.
