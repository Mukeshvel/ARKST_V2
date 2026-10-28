# `package.json`

[Open the original file](../../../package.json) · [Back to file index](../FILE_INDEX.md)

## A. What is this file?

Lists Node 24 requirements, application dependencies and named npm commands.

## B. Why does ARKST need it?

Named commands run quality gates, local integration suites and trusted operator tasks.

## C. How does it work?

The scripts map `npm run check` to formatting, types, lint, tests and build; `test:local` runs real isolated integrations, while `test:rls` runs pgTAP. The file's declarations and imports show the exact behavior; follow its linked collaborators below.

## D. Which files does it connect to?

- No direct project-file import is present; follow the configured tool or route that reads this file.

## E. What happens if I modify this file?

The connected modules listed below may need review and focused regression checks.

## F. How do I verify a safe change?

Run `npm run check`; if the file affects database-backed behavior, also run the relevant `npm run test:local` suite.

## G. Important cautions

Preserve the existing tests and compare behavior with the current architecture before changing this file.
