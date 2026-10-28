# `src/app/globals.css`

[Open the original file](../../../../../src/app/globals.css) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

Contains shared CSS for ARKST pages and responsive layouts.

## B. Why does ARKST need it?

Student and staff pages need readable shared desktop and narrow-screen styling.

## C. How does it work?

Next.js loads it from the root layout; class names used by dashboard components obtain their visual rules here. The file's declarations and imports show the exact behavior; follow its linked collaborators below.

## D. Which files does it connect to?

- No direct project-file import is present; follow the configured tool or route that reads this file.

## E. What happens if I modify this file?

The connected modules listed below may need review and focused regression checks.

## F. How do I verify a safe change?

Run `npm run check`; if the file affects database-backed behavior, also run the relevant `npm run test:local` suite.

## G. Important cautions

Preserve the existing tests and compare behavior with the current architecture before changing this file.
