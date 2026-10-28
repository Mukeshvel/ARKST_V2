# `supabase/config.toml`

[Open the original file](../../../../supabase/config.toml) · [Back to file index](../../FILE_INDEX.md)

## A. What is this file?

Defines the isolated local Supabase project, ports, Auth settings and enabled services.

## B. Why does ARKST need it?

The isolated local database, Auth and API need reproducible ports and signup rules.

## C. How does it work?

The local CLI starts Postgres, Auth and API from this file. Global signup is disabled while email sign-in for already provisioned accounts remains available. The file's declarations and imports show the exact behavior; follow its linked collaborators below.

## D. Which files does it connect to?

- No direct project-file import is present; follow the configured tool or route that reads this file.

## E. What happens if I modify this file?

The connected modules listed below may need review and focused regression checks.

## F. How do I verify a safe change?

Run `npm run check`; if the file affects database-backed behavior, also run the relevant `npm run test:local` suite.

## G. Important cautions

Preserve the existing tests and compare behavior with the current architecture before changing this file.
