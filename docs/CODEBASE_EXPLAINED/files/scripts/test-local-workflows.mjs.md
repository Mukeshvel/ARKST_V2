# `scripts/test-local-workflows.mjs`

[Open the original file](../../../../scripts/test-local-workflows.mjs) · [Back to file index](../../FILE_INDEX.md)

## A. What is this file?

A regression test for follow-up, catch-up, attention and escalation.

## B. Why does ARKST need it?

It supports follow-up, catch-up, attention and escalation. A programmer uses it to operate or maintain the same college application safely.

## C. How does it work?

It checks concrete behaviors such as NPTEL Activity is assigned to real local students; counselor follow-up is scoped, atomic, visible to recipient, and duplicate blocked. Inspect the test setup to distinguish real local Auth/PostgreSQL/HTTP from pure in-process checks. Named declarations include `main`, `config`, `tag`, `options`, `admin`, `db` and others. Examples of checks: NPTEL Activity is assigned to real local students; counselor follow-up is scoped, atomic, visible to recipient, and duplicate blocked; student report resolves follow-up without losing history. API paths named here: `/api/activities/selected`, `/api/follow-ups`, `/api/attention`, `/api/catch-up`.

## D. Which files does it connect to?

- [`tests/integration/local-helpers.mjs`](../../../../tests/integration/local-helpers.mjs) — a real imported or workflow-related file.
- [`package.json`](../../../../package.json) — a real imported or workflow-related file.

## E. What happens if I modify this file?

You change what regressions are detected, not the production feature itself. Keep the assertions tied to real rules.

## F. How do I verify a safe change?

Run `npm run test:local -- workflows` through the existing local wrapper with the isolated Supabase stack; review fixture cleanup.

## G. Important cautions

Do not weaken assertions to make a regression pass. Local synthetic accounts and controlled provider responses are not proof of hosted or desktop delivery.
