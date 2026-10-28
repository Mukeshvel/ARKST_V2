# `scripts/test-local-directory.mjs`

[Open the original file](../../../../scripts/test-local-directory.mjs) · [Back to file index](../../FILE_INDEX.md)

## A. What is this file?

A regression test for staff profiles, roster data and trusted mappings.

## B. Why does ARKST need it?

It supports staff profiles, roster data and trusted mappings. An administrator imports approved names and sections, then links them to existing confirmed accounts.

## C. How does it work?

It checks concrete behaviors such as roster preview validates arbitrary identifiers without writing or creating Auth users; approved roster import commits all rows and direct section memberships atomically. Inspect the test setup to distinguish real local Auth/PostgreSQL/HTTP from pure in-process checks. Named declarations include `exec`, `main`, `config`, `tag`, `options`, `admin` and others. Examples of checks: roster preview validates arbitrary identifiers without writing or creating Auth users; approved roster import commits all rows and direct section memberships atomically; invalid, duplicate and unauthorized counselor mappings never partially commit. Supabase RPCs named here: `submit_activity`, `update_staff_directory_profile`. API paths named here: `/api/counselor/students`, `/api/activities/options`, `/api/activities`, `/api/activities/sections`.

## D. Which files does it connect to?

- [`tests/integration/local-helpers.mjs`](../../../../tests/integration/local-helpers.mjs) — a real imported or workflow-related file.
- [`package.json`](../../../../package.json) — a real imported or workflow-related file.

## E. What happens if I modify this file?

You change what regressions are detected, not the production feature itself. Keep the assertions tied to real rules.

## F. How do I verify a safe change?

Run `npm run test:local -- directory` through the existing local wrapper with the isolated Supabase stack; review fixture cleanup.

## G. Important cautions

Do not weaken assertions to make a regression pass. Local synthetic accounts and controlled provider responses are not proof of hosted or desktop delivery.
