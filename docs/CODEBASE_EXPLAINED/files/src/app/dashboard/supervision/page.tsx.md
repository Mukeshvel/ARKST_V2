# `src/app/dashboard/supervision/page.tsx`

[Open the original file](../../../../../../../src/app/dashboard/supervision/page.tsx) · [Back to file index](../../../../../FILE_INDEX.md)

## A. What is this file?

The server page for `/dashboard/supervision`.

## B. Why does ARKST need it?

It supports department and counselor progress over existing assignments. An explicitly approved HOD checks department and current counselor progress.

## C. How does it work?

It loads or prepares the authorized dashboard view for department and counselor progress over existing assignments, then renders the connected components. Named declarations include `dynamic`, `SupervisionPage`.

## D. Which files does it connect to?

- [`src/app/dashboard/dashboard-nav.tsx`](../../../../../../../src/app/dashboard/dashboard-nav.tsx) — a real imported or workflow-related file.
- [`src/app/dashboard/identity.tsx`](../../../../../../../src/app/dashboard/identity.tsx) — a real imported or workflow-related file.
- [`src/app/dashboard/supervision/supervision-board.tsx`](../../../../../../../src/app/dashboard/supervision/supervision-board.tsx) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The corresponding student or staff screen may change, including its API calls and error states. Confirm both desktop and narrow screens.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- session2` against the existing isolated local stack if this workflow changed.

## G. Important cautions

Do not treat a hidden button as permission control; the API and PostgreSQL checks remain authoritative. Show loading and failure states honestly.
