# `src/app/api/staff-directory/route.ts`

[Open the original file](../../../../../../../src/app/api/staff-directory/route.ts) · [Back to file index](../../../../../FILE_INDEX.md)

## A. What is this file?

The `GET, POST` handler for `/api/staff-directory`.

## B. Why does ARKST need it?

It supports staff profiles, roster data and trusted mappings. An administrator imports approved names and sections, then links them to existing confirmed accounts.

## C. How does it work?

It receives a browser request, validates or delegates it, and returns a response for staff profiles, roster data and trusted mappings. It delegates data work to imported data or validation helpers. HTTP methods: GET, POST. Named declarations include `dynamic`, `GET`, `POST`, `value`. Imported helpers called here: `directoryBody`, `directoryRequest`, `DirectoryError`, `updateStaffDirectory`.

## D. Which files does it connect to?

- [`src/auth/directory-http.ts`](../../../../../../../src/auth/directory-http.ts) — a real imported or workflow-related file.
- [`src/core/staff-directory-input.ts`](../../../../../../../src/core/staff-directory-input.ts) — a real imported or workflow-related file.
- [`src/data/staff-directory.ts`](../../../../../../../src/data/staff-directory.ts) — a real imported or workflow-related file.
- [`src/auth/activity-http.ts`](../../../../../../../src/auth/activity-http.ts) — a real imported or workflow-related file.

## E. What happens if I modify this file?

Callers of this endpoint, input validation and the downstream SQL policy may all be affected. Recheck success and denied roles.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- directory` against the existing isolated local stack if this workflow changed.

## G. Important cautions

Keep same-origin mutation checks, bounded input and caller-session RLS. A UI filter is not an authorization boundary.
