# `deploy/systemd/arkst-calendar.timer`

[Open the original file](../../../../../deploy/systemd/arkst-calendar.timer) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

An inactive Linux systemd unit example for recurring external tests, schedule windows and exam blackouts.

## B. Why does ARKST need it?

It supports recurring external tests, schedule windows and exam blackouts. A coordinator configures an external weekly test; a blackout can stop a future occurrence before students are assigned.

## C. How does it work?

An approved operator must adapt its paths, account and protected environment file before enabling it on a host. The file's declarations and imports show the exact behavior; follow its linked collaborators below.

## D. Which files does it connect to?

- [`docs/RELEASE_OPERATIONS.md`](../../../../RELEASE_OPERATIONS.md) — a real imported or workflow-related file.

## E. What happens if I modify this file?

Only a host that has installed this unit changes; the repository alone does not start a service.

## F. How do I verify a safe change?

Review with `systemd-analyze verify` on the intended Linux host, then test the real service under operator supervision; no local application test proves hosting.

## G. Important cautions

Timezones, blackout overlap and idempotence matter. Existing published Activities must not be silently rewritten; the hosted timer is not running merely because a unit file exists.
