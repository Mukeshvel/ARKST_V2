# `scripts/generate-local-vapid.mjs`

[Open the original file](../../../../scripts/generate-local-vapid.mjs) · [Back to file index](../../FILE_INDEX.md)

## A. What is this file?

A command-line operation for the ARKST application or its development workflow.

## B. Why does ARKST need it?

A developer can create local-only VAPID keys for testing browser push without inventing a provider response.

## C. How does it work?

It runs outside the browser using its own process environment and invokes the modules, SQL or Supabase calls named in the file. Named declarations include `path`, `keys`, `contents`, `file`.

## D. Which files does it connect to?

- [`package.json`](../../../../package.json) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The connected modules listed below may need review and focused regression checks.

## F. How do I verify a safe change?

Run `npm run check`; if the file affects database-backed behavior, also run the relevant `npm run test:local` suite.

## G. Important cautions

Preserve the existing tests and compare behavior with the current architecture before changing this file.
