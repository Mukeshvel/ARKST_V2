# `src/core/calendar-input.ts`

[Open the original file](../../../../../src/core/calendar-input.ts) · [Back to file index](../../../FILE_INDEX.md)

## A. What is this file?

A framework-independent input/rule file for recurring external tests, schedule windows and exam blackouts.

## B. Why does ARKST need it?

It supports recurring external tests, schedule windows and exam blackouts. A coordinator configures an external weekly test; a blackout can stop a future occurrence before students are assigned.

## C. How does it work?

Its exported functions validate values or calculate state before the application sends requests; PostgreSQL still enforces final authorization. Named declarations include `object`, `data`, `text`, `int`, `bool`, `date` and others.

## D. Which files does it connect to?

- [`src/core/activity-input.ts`](../../../../../src/core/activity-input.ts) — a real imported or workflow-related file.

## E. What happens if I modify this file?

The connected modules listed below may need review and focused regression checks.

## F. How do I verify a safe change?

Run `npm run check`, then `npm run test:local -- session2` against the existing isolated local stack if this workflow changed.

## G. Important cautions

Timezones, blackout overlap and idempotence matter. Existing published Activities must not be silently rewritten; the hosted timer is not running merely because a unit file exists.

## Selected-Activity supervision update

`supervisionActivityQuery` removes and validates one optional Activity UUID, then reuses `supervisionQuery` for department, section and offset. The original all-activities input contract is unchanged.
