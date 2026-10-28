# `docs/NOTIFICATIONS.md`

[Open the original file](../../../NOTIFICATIONS.md) · [Back to file index](../../FILE_INDEX.md)

## A. What is this file?

An existing project document about the recipient inbox, unread state and delivery outbox.

## B. Why does ARKST need it?

It supports the recipient inbox, unread state and delivery outbox. A newly assigned student gets an inbox entry; an opted-in browser may also receive a dispatched desktop push.

## C. How does it work?

Read the original for the authoritative detail recorded when it was written; compare dated evidence with current code. The file's declarations and imports show the exact behavior; follow its linked collaborators below.

## D. Which files does it connect to?

- No direct project-file import is present; follow the configured tool or route that reads this file.

## E. What happens if I modify this file?

The connected modules listed below may need review and focused regression checks.

## F. How do I verify a safe change?

Check links and paths against the repository, then run `git diff --check`.

## G. Important cautions

Never log subscription secrets or VAPID private keys. An accepted push-provider request does not prove a Windows popup; check recipient ownership and account switching.
