# `src/auth/directory-http.ts`

[Open the original file](../../../../../src/auth/directory-http.ts) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

A server-side authentication or request-boundary module for staff profiles, roster data and trusted mappings.

## B. Why does ARKST need it?

It supports staff profiles, roster data and trusted mappings. An administrator imports approved names and sections, then links them to existing confirmed accounts.

## C. How does it work?

It checks identity, cookies, origins, request shape or public error mapping before protected data is returned. Named declarations include `directoryRequest`, `e`, `directoryBody`, `reader`, `chunks`. Imported helpers called here: `DirectoryError`.

## D. Which files does it connect to?

- [`src/auth/identity.ts`](../../../../../src/auth/identity.ts) — a real imported or workflow-related file.
- [`src/auth/server.ts`](../../../../../src/auth/server.ts) — a real imported or workflow-related file.
- [`src/auth/http.ts`](../../../../../src/auth/http.ts) — a real imported or workflow-related file.
- [`src/auth/errors.ts`](../../../../../src/auth/errors.ts) — a real imported or workflow-related file.
- [`src/core/staff-directory-input.ts`](../../../../../src/core/staff-directory-input.ts) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The connected modules listed below may need review and focused regression checks.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- directory` against the existing isolated local stack if this workflow changed.

## G. Important cautions

A valid sign-in is not permission to view other students. Keep the active-profile check, exact origin/session behavior and trusted database grants. Google provider exchange still needs external configuration and testing.
