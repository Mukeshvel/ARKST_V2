# `scripts/lib/operator-db.mjs`

[Open the original file](../../../../../scripts/lib/operator-db.mjs) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

A command-line operation for the ARKST application or its development workflow.

## B. Why does ARKST need it?

Owner database access should default to isolated loopback and require explicit hosted activation.

## C. How does it work?

It runs outside the browser using its own process environment and invokes the modules, SQL or Supabase calls named in the file. Named declarations include `operatorDatabaseConfig`.

## D. Which files does it connect to?

- [`tests/integration/local-helpers.mjs`](../../../../../tests/integration/local-helpers.mjs) — a real imported or workflow-related file.
- [`scripts/lib/hosted-db.mjs`](../../../../../scripts/lib/hosted-db.mjs) — a real imported or workflow-related file.
- [`package.json`](../../../../../package.json) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The connected modules listed below may need review and focused regression checks.

## F. How do I verify a safe change?

Run `npm run check`; if the file affects database-backed behavior, also run the relevant `npm run test:local` suite.

## G. Important cautions

This path may use an owner connection. Preview and approval are essential; never pass production credentials to local tests or the web process.
