# `scripts/admin-operations.mjs`

[Open the original file](../../../../scripts/admin-operations.mjs) · [Back to file index](../../FILE_INDEX.md)

## A. What is this file?

A command-line operation for section publication, announcements and monitoring.

## B. Why does ARKST need it?

It supports section publication, announcements and monitoring. A programmer uses it to operate or maintain the same college application safely.

## C. How does it work?

It runs outside the browser using its own process environment and invokes the modules, SQL or Supabase calls named in the file. Named declarations include `uuid`, `argumentsFrom`, `options`, `key`, `admin`, `result` and others. This restricted CLI grants category CREATE/VERIFY, assigns or ends ordinary responsibilities, and sets escalation routes. It blocks unsafe removals with live mappings/routes/open cases and records actor/time/before/after in `trusted_operator_history`. It does not bootstrap HOD/admin.

## D. Which files does it connect to?

- [`scripts/lib/operator-db.mjs`](../../../../scripts/lib/operator-db.mjs) — a real imported or workflow-related file.
- [`package.json`](../../../../package.json) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The connected modules listed below may need review and focused regression checks.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- operations` against the existing isolated local stack if this workflow changed.

## G. Important cautions

This path may use an owner connection. Preview and approval are essential; never pass production credentials to local tests or the web process.
