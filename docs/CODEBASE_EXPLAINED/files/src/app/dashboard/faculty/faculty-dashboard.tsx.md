# `src/app/dashboard/faculty/faculty-dashboard.tsx`

[Open the original file](../../../../../../../src/app/dashboard/faculty/faculty-dashboard.tsx) · [Back to file index](../../../../../FILE_INDEX.md)

## A. What is this file?

A dashboard UI component for faculty Activity creation and creator monitoring.

## B. Why does ARKST need it?

It supports faculty Activity creation and creator monitoring. A teacher assigns NPTEL work and assigned students report external completion.

## C. How does it work?

It renders the labels, forms, lists or progress shown to a signed-in user and calls the named API paths or imported helpers in this file. Named declarations include `FormEvent`, `Candidate`, `Created`, `FacultyDashboard`, `selection`, `saveInFlight` and others. API paths named here: `/api/activities/options`, `/api/activities/sections`, `/api/activities/selected`. The faculty screen loads creation options and previously created Activities, offers section/direct/counseling recipient selection, and submits to authenticated Activity APIs. It shows success only after a persisted API result; the server and SQL recheck scope.

## D. Which files does it connect to?

- [`src/app/dashboard/dashboard-data.ts`](../../../../../../../src/app/dashboard/dashboard-data.ts) — a real imported or workflow-related file.
- [`src/app/dashboard/faculty/candidate-picker.tsx`](../../../../../../../src/app/dashboard/faculty/candidate-picker.tsx) — a real imported or workflow-related file.
- [`src/app/dashboard/dashboard-nav.tsx`](../../../../../../../src/app/dashboard/dashboard-nav.tsx) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The corresponding student or staff screen may change, including its API calls and error states. Confirm both desktop and narrow screens.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- operations` against the existing isolated local stack if this workflow changed.

## G. Important cautions

Do not treat a hidden button as permission control; the API and PostgreSQL checks remain authoritative. Show loading and failure states honestly.
