# `src/app/dashboard/calendar/calendar-workspace.tsx`

[Open the original file](../../../../../../../src/app/dashboard/calendar/calendar-workspace.tsx) · [Back to file index](../../../../../FILE_INDEX.md)

## A. What is this file?

A dashboard UI component for recurring external tests, schedule windows and exam blackouts.

## B. Why does ARKST need it?

It supports recurring external tests, schedule windows and exam blackouts. A coordinator configures an external weekly test; a blackout can stop a future occurrence before students are assigned.

## C. How does it work?

It renders the labels, forms, lists or progress shown to a signed-in user and calls the named API paths or imported helpers in this file. Named declarations include `FormEvent`, `Department`, `Section`, `Slot`, `Schedule`, `Blackout` and others. API paths named here: `/api/department-operations`, `/api/calendar/schedules`, `/api/calendar/blackouts`. Authorized staff can configure schedules, editable slots, blackout periods and conflict decisions, and manually generate due instances. Saved calendar data is read back from PostgreSQL; the page itself is not an unattended scheduler.

## D. Which files does it connect to?

- [`src/app/dashboard/dashboard-data.ts`](../../../../../../../src/app/dashboard/dashboard-data.ts) — a real imported or workflow-related file.
- [`src/app/dashboard/dashboard-nav.tsx`](../../../../../../../src/app/dashboard/dashboard-nav.tsx) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The corresponding student or staff screen may change, including its API calls and error states. Confirm both desktop and narrow screens.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- session2` against the existing isolated local stack if this workflow changed.

## G. Important cautions

Timezones, blackout overlap and idempotence matter. Existing published Activities must not be silently rewritten; the hosted timer is not running merely because a unit file exists.
