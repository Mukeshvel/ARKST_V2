# `src/data/README.md`

[Open the original file](../../../../../src/data/README.md) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

A server-only data access module for the ARKST application or its development workflow.

## B. Why does ARKST need it?

It supports the ARKST application or its development workflow. A programmer uses it to operate or maintain the same college application safely.

## C. How does it work?

It uses the authenticated Supabase client to query RLS-protected tables or call named SQL functions; the browser never receives an owner database key. The file's declarations and imports show the exact behavior; follow its linked collaborators below.

## D. Which files does it connect to?

- No direct project-file import is present; follow the configured tool or route that reads this file.

## E. What happens if I modify this file?

The connected modules listed below may need review and focused regression checks.

## F. How do I verify a safe change?

Run `npm run check`; if the file affects database-backed behavior, also run the relevant `npm run test:local` suite.

## G. Important cautions

Keep same-origin mutation checks, bounded input and caller-session RLS. A UI filter is not an authorization boundary.
