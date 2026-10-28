# `scripts/directory-admin.mjs`

[Open the original file](../../../../scripts/directory-admin.mjs) · [Back to file index](../../FILE_INDEX.md)

## A. What is this file?

A command-line operation for staff profiles, roster data and trusted mappings.

## B. Why does ARKST need it?

It supports staff profiles, roster data and trusted mappings. An administrator imports approved names and sections, then links them to existing confirmed accounts.

## C. How does it work?

It runs outside the browser using its own process environment and invokes the modules, SQL or Supabase calls named in the file. Named declarations include `args`, `out`, `key`, `csv`, `rows`, `c` and others. This restricted CLI previews by default, then rechecks current exact-department admin authority in a transaction for imports/provisioning. It validates CSV relationships, preserves historical counselor mappings and links an existing confirmed Auth user only to the approved roster email. `--apply` is required to write.

## D. Which files does it connect to?

- [`scripts/lib/operator-db.mjs`](../../../../scripts/lib/operator-db.mjs) — a real imported or workflow-related file.
- [`package.json`](../../../../package.json) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The connected modules listed below may need review and focused regression checks.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- directory` against the existing isolated local stack if this workflow changed.

## G. Important cautions

This path may use an owner connection. Preview and approval are essential; never pass production credentials to local tests or the web process.
