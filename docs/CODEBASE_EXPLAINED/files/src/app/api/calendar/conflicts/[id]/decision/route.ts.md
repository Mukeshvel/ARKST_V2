# `src/app/api/calendar/conflicts/[id]/decision/route.ts`

[Open the original file](../../../../../../../../../../src/app/api/calendar/conflicts/[id]/decision/route.ts) · [Back to file index](../../../../../../../../FILE_INDEX.md)

## A. What is this file?

The `POST` handler for `/api/calendar/conflicts/[id]/decision`.

## B. Why does ARKST need it?

It supports recurring external tests, schedule windows and exam blackouts. A coordinator configures an external weekly test; a blackout can stop a future occurrence before students are assigned.

## C. How does it work?

It receives a browser request, validates or delegates it, and returns a response for recurring external tests, schedule windows and exam blackouts. It delegates data work to imported data or validation helpers. HTTP methods: POST. Named declarations include `dynamic`, `POST`. Imported helpers called here: `activityRequest`, `readActivityJson`, `activityId`, `decisionInput`, `departmentRpc`.

## D. Which files does it connect to?

- [`src/auth/activity-http.ts`](../../../../../../../../../../src/auth/activity-http.ts) — a real imported or workflow-related file.
- [`src/core/activity-input.ts`](../../../../../../../../../../src/core/activity-input.ts) — a real imported or workflow-related file.
- [`src/core/calendar-input.ts`](../../../../../../../../../../src/core/calendar-input.ts) — a real imported or workflow-related file.
- [`src/data/department-operations.ts`](../../../../../../../../../../src/data/department-operations.ts) — a real imported or workflow-related file.

## E. What happens if I modify this file?

Callers of this endpoint, input validation and the downstream SQL policy may all be affected. Recheck success and denied roles.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- session2` against the existing isolated local stack if this workflow changed.

## G. Important cautions

Timezones, blackout overlap and idempotence matter. Existing published Activities must not be silently rewritten; the hosted timer is not running merely because a unit file exists.
