# `src/app/dashboard/counselor/activities/[id]/page.tsx`

[Open the original file](../../../../../../../../../src/app/dashboard/counselor/activities/[id]/page.tsx) · [Back to file index](../../../../../../../FILE_INDEX.md)

## A. What is this file?

The server page for `/dashboard/counselor/activities/[id]`.

## B. Why does ARKST need it?

It supports trusted counselor-to-student monitoring. A counselor sees only students in current trusted mappings.

## C. How does it work?

It loads or prepares the authorized dashboard view for trusted counselor-to-student monitoring, then renders the connected components. Named declarations include `dynamic`, `CounselorActivityPage`.

## D. Which files does it connect to?

- [`src/app/dashboard/dashboard-nav.tsx`](../../../../../../../../../src/app/dashboard/dashboard-nav.tsx) — a real imported or workflow-related file.
- [`src/app/dashboard/identity.tsx`](../../../../../../../../../src/app/dashboard/identity.tsx) — a real imported or workflow-related file.
- [`src/app/dashboard/counselor/activities/[id]/counselor-results.tsx`](../../../../../../../../../src/app/dashboard/counselor/activities/[id]/counselor-results.tsx) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The corresponding student or staff screen may change, including its API calls and error states. Confirm both desktop and narrow screens.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- directory` against the existing isolated local stack if this workflow changed.

## G. Important cautions

Do not treat a hidden button as permission control; the API and PostgreSQL checks remain authoritative. Show loading and failure states honestly.
