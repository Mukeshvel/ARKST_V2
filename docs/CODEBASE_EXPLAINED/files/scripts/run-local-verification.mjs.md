# `scripts/run-local-verification.mjs`

[Open the original file](../../../../scripts/run-local-verification.mjs) · [Back to file index](../../FILE_INDEX.md)

## A. What is this file?

A command-line operation for the ARKST application or its development workflow.

## B. Why does ARKST need it?

The real local test wrapper must reject remote targets and confirm app readiness before running synthetic Auth and database tests.

## C. How does it work?

It runs outside the browser using its own process environment and invokes the modules, SQL or Supabase calls named in the file. Named declarations include `execute`, `main`, `suite`, `settings`, `socket`, `port` and others. This wrapper checks that the target URLs and database are isolated loopback services, starts a temporary production Next server, waits for a real readiness response, runs the selected integration suites, and stops the server. It never substitutes mock Auth for local Supabase.

## D. Which files does it connect to?

- [`tests/integration/local-helpers.mjs`](../../../../tests/integration/local-helpers.mjs) — a real imported or workflow-related file.
- [`package.json`](../../../../package.json) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The connected modules listed below may need review and focused regression checks.

## F. How do I verify a safe change?

Run `npm run check`; if the file affects database-backed behavior, also run the relevant `npm run test:local` suite.

## G. Important cautions

Preserve the existing tests and compare behavior with the current architecture before changing this file.
