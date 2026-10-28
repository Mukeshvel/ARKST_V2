# `src/data/staff-directory.ts`

[Open the original file](../../../../../src/data/staff-directory.ts) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

A server-only data access module for staff profiles, roster data and trusted mappings.

## B. Why does ARKST need it?

It supports staff profiles, roster data and trusted mappings. An administrator imports approved names and sections, then links them to existing confirmed accounts.

## C. How does it work?

It uses the authenticated Supabase client to query RLS-protected tables or call named SQL functions; the browser never receives an owner database key. Named declarations include `unwrap`, `loadStaffDirectory`, `identity`, `sections`, `profile`, `preferences` and others. Supabase RPCs named here: `staff_available_sections`, `update_staff_directory_profile`. Imported helpers called here: `DirectoryError`, `staffDirectoryInput`.

## D. Which files does it connect to?

- [`src/core/staff-directory-input.ts`](../../../../../src/core/staff-directory-input.ts) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The connected modules listed below may need review and focused regression checks.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- directory` against the existing isolated local stack if this workflow changed.

## G. Important cautions

Keep same-origin mutation checks, bounded input and caller-session RLS. A UI filter is not an authorization boundary.
