# `scripts/run-recurring-hosted.mjs`

[Open the original file](../../../../scripts/run-recurring-hosted.mjs) · [Back to file index](../../FILE_INDEX.md)

## A. What is this file?

A command-line operation for recurring external tests, schedule windows and exam blackouts.

## B. Why does ARKST need it?

It supports recurring external tests, schedule windows and exam blackouts. A coordinator configures an external weekly test; a blackout can stop a future occurrence before students are assigned.

## C. How does it work?

It runs outside the browser using its own process environment and invokes the modules, SQL or Supabase calls named in the file. Named declarations include `hostedRunnerConfig`, `main`, `config`, `client`, `signIn`, `result` and others. The hosted runner requires explicit enablement and a restricted existing staff credential, signs in through real Supabase Auth, enumerates only granted calendars and runs a short horizon, then clears its own session. This file does not schedule itself.

## D. Which files does it connect to?

- [`scripts/lib/recurring-runner.mjs`](../../../../scripts/lib/recurring-runner.mjs) — a real imported or workflow-related file.
- [`package.json`](../../../../package.json) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The connected modules listed below may need review and focused regression checks.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- session2` against the existing isolated local stack if this workflow changed.

## G. Important cautions

Timezones, blackout overlap and idempotence matter. Existing published Activities must not be silently rewritten; the hosted timer is not running merely because a unit file exists.
