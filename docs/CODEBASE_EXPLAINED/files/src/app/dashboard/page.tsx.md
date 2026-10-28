# `src/app/dashboard/page.tsx`

[Open the original file](../../../../../../src/app/dashboard/page.tsx) · [Back to file index](../../../../FILE_INDEX.md)

## A. What is this file?

The server page for `/dashboard`.

## B. Why does ARKST need it?

Signed-in users should reach the student or staff dashboard that matches their profile.

## C. How does it work?

It loads or prepares the authorized dashboard view for the ARKST application or its development workflow, then renders the connected components. Named declarations include `dynamic`, `DashboardHome`.

## D. Which files does it connect to?

- [`src/app/dashboard/identity.tsx`](../../../../../../src/app/dashboard/identity.tsx) — a real imported or workflow-related file.
- [`src/app/dashboard/dashboard-nav.tsx`](../../../../../../src/app/dashboard/dashboard-nav.tsx) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The corresponding student or staff screen may change, including its API calls and error states. Confirm both desktop and narrow screens.

## F. How do I verify a safe change?

Run `npm run check`; if the file affects database-backed behavior, also run the relevant `npm run test:local` suite.

## G. Important cautions

Do not treat a hidden button as permission control; the API and PostgreSQL checks remain authoritative. Show loading and failure states honestly.
