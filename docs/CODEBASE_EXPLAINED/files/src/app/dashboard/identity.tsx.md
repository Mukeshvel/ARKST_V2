# `src/app/dashboard/identity.tsx`

[Open the original file](../../../../../../src/app/dashboard/identity.tsx) · [Back to file index](../../../../FILE_INDEX.md)

## A. What is this file?

A dashboard UI component for confirmed Auth users, active profiles and current responsibilities.

## B. Why does ARKST need it?

It supports confirmed Auth users, active profiles and current responsibilities. A signed-in teacher must still have an active approved profile and exact capability to assign students.

## C. How does it work?

It renders the labels, forms, lists or progress shown to a signed-in user and calls the named API paths or imported helpers in this file. Named declarations include `dashboardIdentity`, `failure`, `DashboardFailure`. Imported helpers called here: `requireOwnIdentity`, `publicIdentityError`.

## D. Which files does it connect to?

- [`src/auth/identity.ts`](../../../../../../src/auth/identity.ts) — a real imported or workflow-related file.
- [`src/auth/errors.ts`](../../../../../../src/auth/errors.ts) — a real imported or workflow-related file.
- [`src/app/dashboard/dashboard-nav.tsx`](../../../../../../src/app/dashboard/dashboard-nav.tsx) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The corresponding student or staff screen may change, including its API calls and error states. Confirm both desktop and narrow screens.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- identity` against the existing isolated local stack if this workflow changed.

## G. Important cautions

A valid sign-in is not permission to view other students. Keep the active-profile check, exact origin/session behavior and trusted database grants. Google provider exchange still needs external configuration and testing.
