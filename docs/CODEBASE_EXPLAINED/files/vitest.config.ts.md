# `vitest.config.ts`

[Open the original file](../../../vitest.config.ts) · [Back to file index](../FILE_INDEX.md)

## A. What is this file?

Configures the Vitest unit-test runner.

## B. Why does ARKST need it?

The unit test runner needs a consistent project configuration.

## C. How does it work?

`npm test` uses it for pure TypeScript tests; real database tests are separate. The file's declarations and imports show the exact behavior; follow its linked collaborators below.

## D. Which files does it connect to?

- No direct project-file import is present; follow the configured tool or route that reads this file.

## E. What happens if I modify this file?

The connected modules listed below may need review and focused regression checks.

## F. How do I verify a safe change?

Run `npm run check`; if the file affects database-backed behavior, also run the relevant `npm run test:local` suite.

## G. Important cautions

Preserve the existing tests and compare behavior with the current architecture before changing this file.
