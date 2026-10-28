# `tests/integration/local-helpers.mjs`

[Open the original file](../../../../../tests/integration/local-helpers.mjs) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

A test helper for the ARKST application or its development workflow.

## B. Why does ARKST need it?

Synthetic tests must stay on loopback and use separate real signed-in sessions.

## C. How does it work?

It supports deterministic or real local integration checks, depending on the function used by the caller. Named declarations include `loopbackHosts`, `required`, `value`, `localUrl`, `localTestConfiguration`, `app` and others. These helpers reject remote test targets, provide real local HTTP/Supabase configuration, and let integration scripts maintain separate authenticated browser sessions. Keeping the loopback guard prevents synthetic tests from writing to a hosted project.

## D. Which files does it connect to?

- [`package.json`](../../../../../package.json) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The connected modules listed below may need review and focused regression checks.

## F. How do I verify a safe change?

Run `npm run check`; if the file affects database-backed behavior, also run the relevant `npm run test:local` suite.

## G. Important cautions

Preserve the existing tests and compare behavior with the current architecture before changing this file.
