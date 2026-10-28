# `src/app/dashboard/student/page.tsx`

[Open the original file](../../../../../../../src/app/dashboard/student/page.tsx) · [Back to file index](../../../../../FILE_INDEX.md)

## A. What is this file?

The server page for `/dashboard/student`.

## B. Why does ARKST need it?

It supports student assignment visibility and own completion. A teacher assigns NPTEL work and assigned students report external completion.

## C. How does it work?

It loads or prepares the authorized dashboard view for student assignment visibility and own completion, then renders the connected components. Named declarations include `dynamic`, `StudentPage`.

## D. Which files does it connect to?

- [`src/app/dashboard/dashboard-nav.tsx`](../../../../../../../src/app/dashboard/dashboard-nav.tsx) — a real imported or workflow-related file.
- [`src/app/dashboard/identity.tsx`](../../../../../../../src/app/dashboard/identity.tsx) — a real imported or workflow-related file.
- [`src/app/dashboard/student/student-dashboard.tsx`](../../../../../../../src/app/dashboard/student/student-dashboard.tsx) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The corresponding student or staff screen may change, including its API calls and error states. Confirm both desktop and narrow screens.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- activity` against the existing isolated local stack if this workflow changed.

## G. Important cautions

Do not treat a hidden button as permission control; the API and PostgreSQL checks remain authoritative. Show loading and failure states honestly.
