# `src/app/dashboard/groups/group-workspace.tsx`

[Open the original file](../../../../../../../src/app/dashboard/groups/group-workspace.tsx) · [Back to file index](../../../../../FILE_INDEX.md)

## A. What is this file?

A dashboard UI component for named student groups and publication snapshots.

## B. Why does ARKST need it?

It supports named student groups and publication snapshots. A placement group is edited without rewriting already published student assignments.

## C. How does it work?

It renders the labels, forms, lists or progress shown to a signed-in user and calls the named API paths or imported helpers in this file. Named declarations include `FormEvent`, `Department`, `Group`, `Student`, `CurrentMember`, `History` and others. API paths named here: `/api/department-operations`, `/api/activities/options`, `/api/groups`. Authorized staff can create/rename groups, change current membership and publish a group Activity or announcement. The publication snapshot remains in ordinary assignment/notification tables after membership changes.

## D. Which files does it connect to?

- [`src/app/dashboard/dashboard-data.ts`](../../../../../../../src/app/dashboard/dashboard-data.ts) — a real imported or workflow-related file.
- [`src/app/dashboard/dashboard-nav.tsx`](../../../../../../../src/app/dashboard/dashboard-nav.tsx) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The corresponding student or staff screen may change, including its API calls and error states. Confirm both desktop and narrow screens.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- session2` against the existing isolated local stack if this workflow changed.

## G. Important cautions

Do not treat a hidden button as permission control; the API and PostgreSQL checks remain authoritative. Show loading and failure states honestly.
