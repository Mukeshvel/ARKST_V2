# `src/app/dashboard/supervision/activity-supervision.tsx`

[Source](../../../../../../../src/app/dashboard/supervision/activity-supervision.tsx)

## A. What is this file?

Small client component for selected-Activity counselor reporting.

## B. Why does ARKST need it?

An HOD chooses the NPTEL assignment, reads counselor and department counts, and expands assigned student results.

## C. How does it work?

Loads choices and results from /api/supervision/activities. It displays full-dataset counts and a paged student detail list. It clears old results on selection changes and ignores stale responses after selection, department or section changes. The parent remounts it on a scope change. Verified is separate from all reported submissions.

## D. Which files does it connect to?

- [`src/app/dashboard/supervision/supervision-board.tsx`](../../../../../../../src/app/dashboard/supervision/supervision-board.tsx)
- [`src/app/dashboard/dashboard-data.ts`](../../../../../../../src/app/dashboard/dashboard-data.ts)
- [`src/app/api/supervision/activities/route.ts`](../../../../../../../src/app/api/supervision/activities/route.ts)

## E. What happens if I modify this file?

Keep summary numbers supplied by SQL; never compute them from the visible student page. Changes must retain honest loading and failure messages.

## F. How do I verify a safe change?

npm run check; Session 2 real Edge test selects the Activity and checks counselor totals.

## G. Important cautions

The UI is not an authorization boundary. No private information should be inferred from an unavailable or failed response.
