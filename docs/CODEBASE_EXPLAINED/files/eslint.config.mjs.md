# `eslint.config.mjs`

[Open the original file](../../../eslint.config.mjs) · [Back to file index](../FILE_INDEX.md)

## A. What is this file?

Configures ESLint rules used by `npm run lint`.

## B. Why does ARKST need it?

The repository uses lint rules to catch source problems before deployment.

## C. How does it work?

It combines TypeScript and Next.js checks so risky or inconsistent code is flagged before build. The file's declarations and imports show the exact behavior; follow its linked collaborators below.

## D. Which files does it connect to?

- No direct project-file import is present; follow the configured tool or route that reads this file.

## E. What happens if I modify this file?

The connected modules listed below may need review and focused regression checks.

## F. How do I verify a safe change?

Run `npm run check`; if the file affects database-backed behavior, also run the relevant `npm run test:local` suite.

## G. Important cautions

Preserve the existing tests and compare behavior with the current architecture before changing this file.
