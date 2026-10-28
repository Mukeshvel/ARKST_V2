# `deploy/systemd/arkst-push.service`

[Open the original file](../../../../../deploy/systemd/arkst-push.service) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

An inactive Linux systemd unit example for desktop push subscription and delivery.

## B. Why does ARKST need it?

It supports desktop push subscription and delivery. A newly assigned student gets an inbox entry; an opted-in browser may also receive a dispatched desktop push.

## C. How does it work?

An approved operator must adapt its paths, account and protected environment file before enabling it on a host. The file's declarations and imports show the exact behavior; follow its linked collaborators below.

## D. Which files does it connect to?

- [`docs/RELEASE_OPERATIONS.md`](../../../../RELEASE_OPERATIONS.md) — a real imported or workflow-related file.

## E. What happens if I modify this file?

Only a host that has installed this unit changes; the repository alone does not start a service.

## F. How do I verify a safe change?

Review with `systemd-analyze verify` on the intended Linux host, then test the real service under operator supervision; no local application test proves hosting.

## G. Important cautions

Never log subscription secrets or VAPID private keys. An accepted push-provider request does not prove a Windows popup; check recipient ownership and account switching.
