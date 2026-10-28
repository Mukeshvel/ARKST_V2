# `src/app/dashboard/follow-up-panel.tsx`

[Open the original file](../../../../../../src/app/dashboard/follow-up-panel.tsx) · [Back to file index](../../../../FILE_INDEX.md)

## A. What is this file?

A dashboard UI component for pending-student follow-ups and their history.

## B. Why does ARKST need it?

It supports pending-student follow-ups and their history. A counselor contacts a pending student and later sees that follow-up resolve when the student reports completion.

## C. How does it work?

It renders the labels, forms, lists or progress shown to a signed-in user and calls the named API paths or imported helpers in this file. Named declarations include `FollowUpTarget`, `FollowUp`, `FollowUpPanel`, `ids`, `load`, `query` and others. API paths named here: `/api/follow-ups`.

## D. Which files does it connect to?

- [`src/app/dashboard/dashboard-data.ts`](../../../../../../src/app/dashboard/dashboard-data.ts) — a real imported or workflow-related file.
- [`src/app/dashboard/dashboard-nav.tsx`](../../../../../../src/app/dashboard/dashboard-nav.tsx) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The corresponding student or staff screen may change, including its API calls and error states. Confirm both desktop and narrow screens.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- workflows` against the existing isolated local stack if this workflow changed.

## G. Important cautions

Do not treat a hidden button as permission control; the API and PostgreSQL checks remain authoritative. Show loading and failure states honestly.
