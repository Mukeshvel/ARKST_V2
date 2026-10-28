# `src/app/dashboard/counselor/activities/[id]/counselor-results.tsx`

[Open the original file](../../../../../../../../../src/app/dashboard/counselor/activities/[id]/counselor-results.tsx) · [Back to file index](../../../../../../../FILE_INDEX.md)

## A. What is this file?

A dashboard UI component for trusted counselor-to-student monitoring.

## B. Why does ARKST need it?

It supports trusted counselor-to-student monitoring. A counselor sees only students in current trusted mappings.

## C. How does it work?

It renders the labels, forms, lists or progress shown to a signed-in user and calls the named API paths or imported helpers in this file. Named declarations include `Row`, `Detail`, `Filter`, `labels`, `state`, `CounselorResults` and others.

## D. Which files does it connect to?

- [`src/app/dashboard/dashboard-data.ts`](../../../../../../../../../src/app/dashboard/dashboard-data.ts) — a real imported or workflow-related file.
- [`src/app/dashboard/completion-progress.tsx`](../../../../../../../../../src/app/dashboard/completion-progress.tsx) — a real imported or workflow-related file.
- [`src/app/dashboard/pending-copy-button.tsx`](../../../../../../../../../src/app/dashboard/pending-copy-button.tsx) — a real imported or workflow-related file.
- [`src/app/dashboard/follow-up-panel.tsx`](../../../../../../../../../src/app/dashboard/follow-up-panel.tsx) — a real imported or workflow-related file.
- [`src/app/dashboard/escalation-action.tsx`](../../../../../../../../../src/app/dashboard/escalation-action.tsx) — a real imported or workflow-related file.
- [`src/app/dashboard/dashboard-nav.tsx`](../../../../../../../../../src/app/dashboard/dashboard-nav.tsx) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The corresponding student or staff screen may change, including its API calls and error states. Confirm both desktop and narrow screens.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- directory` against the existing isolated local stack if this workflow changed.

## G. Important cautions

Do not treat a hidden button as permission control; the API and PostgreSQL checks remain authoritative. Show loading and failure states honestly.
