# `src/app/dashboard/dashboard-nav.tsx`

[Open the original file](../../../../../../src/app/dashboard/dashboard-nav.tsx) · [Back to file index](../../../../FILE_INDEX.md)

## A. What is this file?

A dashboard UI component for the ARKST application or its development workflow.

## B. Why does ARKST need it?

A signed-in user needs links to relevant operational screens and logout.

## C. How does it work?

It renders the labels, forms, lists or progress shown to a signed-in user and calls the named API paths or imported helpers in this file. Named declarations include `currentCounselor`, `now`, `DashboardNav`.

## D. Which files does it connect to?

- [`src/data/identity.ts`](../../../../../../src/data/identity.ts) — a real imported or workflow-related file.
- [`src/app/dashboard/inbox-link.tsx`](../../../../../../src/app/dashboard/inbox-link.tsx) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The corresponding student or staff screen may change, including its API calls and error states. Confirm both desktop and narrow screens.

## F. How do I verify a safe change?

Run `npm run check`; if the file affects database-backed behavior, also run the relevant `npm run test:local` suite.

## G. Important cautions

Do not treat a hidden button as permission control; the API and PostgreSQL checks remain authoritative. Show loading and failure states honestly.
