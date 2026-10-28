# `src/app/dashboard/calendar/page.tsx`

[Open the original file](../../../../../../../src/app/dashboard/calendar/page.tsx) · [Back to file index](../../../../../FILE_INDEX.md)

## A. What is this file?

The server page for `/dashboard/calendar`.

## B. Why does ARKST need it?

It supports recurring external tests, schedule windows and exam blackouts. A coordinator configures an external weekly test; a blackout can stop a future occurrence before students are assigned.

## C. How does it work?

It loads or prepares the authorized dashboard view for recurring external tests, schedule windows and exam blackouts, then renders the connected components. Named declarations include `dynamic`, `CalendarPage`.

## D. Which files does it connect to?

- [`src/app/dashboard/dashboard-nav.tsx`](../../../../../../../src/app/dashboard/dashboard-nav.tsx) — a real imported or workflow-related file.
- [`src/app/dashboard/identity.tsx`](../../../../../../../src/app/dashboard/identity.tsx) — a real imported or workflow-related file.
- [`src/app/dashboard/calendar/calendar-workspace.tsx`](../../../../../../../src/app/dashboard/calendar/calendar-workspace.tsx) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The corresponding student or staff screen may change, including its API calls and error states. Confirm both desktop and narrow screens.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- session2` against the existing isolated local stack if this workflow changed.

## G. Important cautions

Timezones, blackout overlap and idempotence matter. Existing published Activities must not be silently rewritten; the hosted timer is not running merely because a unit file exists.
