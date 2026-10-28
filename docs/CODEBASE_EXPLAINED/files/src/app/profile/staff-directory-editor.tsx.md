# `src/app/profile/staff-directory-editor.tsx`

[Open the original file](../../../../../../src/app/profile/staff-directory-editor.tsx) · [Back to file index](../../../../FILE_INDEX.md)

## A. What is this file?

An application source file for staff profiles, roster data and trusted mappings.

## B. Why does ARKST need it?

It supports staff profiles, roster data and trusted mappings. An administrator imports approved names and sections, then links them to existing confirmed accounts.

## C. How does it work?

It supplies the exported behavior or styling used by the app. Named declarations include `FormEvent`, `Directory`, `StaffDirectoryEditor`, `body`, `submit`, `form` and others. API paths named here: `/api/staff-directory`.

## D. Which files does it connect to?

- No direct project-file import is present; follow the configured tool or route that reads this file.

## E. What happens if I modify this file?

The connected modules listed below may need review and focused regression checks.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- directory` against the existing isolated local stack if this workflow changed.

## G. Important cautions

Preserve the existing tests and compare behavior with the current architecture before changing this file.
