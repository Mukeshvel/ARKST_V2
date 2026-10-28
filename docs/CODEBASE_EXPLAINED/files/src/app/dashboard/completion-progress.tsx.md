# `src/app/dashboard/completion-progress.tsx`

[Open the original file](../../../../../../src/app/dashboard/completion-progress.tsx) · [Back to file index](../../../../FILE_INDEX.md)

## A. What is this file?

A dashboard UI component for students' reported and staff-verified completion.

## B. Why does ARKST need it?

It supports students' reported and staff-verified completion. A teacher assigns NPTEL work and assigned students report external completion.

## C. How does it work?

It renders the labels, forms, lists or progress shown to a signed-in user and calls the named API paths or imported helpers in this file. Named declarations include `CompletionProgress`, `completed`, `percent`.

## D. Which files does it connect to?

- [`src/app/dashboard/dashboard-nav.tsx`](../../../../../../src/app/dashboard/dashboard-nav.tsx) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The corresponding student or staff screen may change, including its API calls and error states. Confirm both desktop and narrow screens.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- activity` against the existing isolated local stack if this workflow changed.

## G. Important cautions

Do not treat a hidden button as permission control; the API and PostgreSQL checks remain authoritative. Show loading and failure states honestly.
