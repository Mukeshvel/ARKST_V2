# `src/app/layout.tsx`

[Open the original file](../../../../../src/app/layout.tsx) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

Defines the root Next.js HTML layout and global style import.

## B. Why does ARKST need it?

Every route needs one consistent HTML shell and global styling.

## C. How does it work?

Every page renders inside it, so a layout or metadata change affects the whole app. Named declarations include `config`, `metadata`, `RootLayout`.

## D. Which files does it connect to?

- [`src/config/env.ts`](../../../../../src/config/env.ts) — a real imported or workflow-related file.
- [`src/app/globals.css`](../../../../../src/app/globals.css) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The connected modules listed below may need review and focused regression checks.

## F. How do I verify a safe change?

Run `npm run check`; if the file affects database-backed behavior, also run the relevant `npm run test:local` suite.

## G. Important cautions

Preserve the existing tests and compare behavior with the current architecture before changing this file.
