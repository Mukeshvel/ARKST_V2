# How recurring tests and blackouts work

ARKST schedules **external** tests. It does not host a coding or aptitude exam.
An authorized coordinator defines availability windows; generated instances are
ordinary Activities with student assignments and deadlines.

## Configure a schedule

[The calendar screen](../../src/app/dashboard/calendar/calendar-workspace.tsx)
uses authenticated APIs for a named schedule, sections, editable slots and
blackout periods. A schedule starts paused. The manager chooses an anchor Monday,
an IANA timezone (initial suggestion: Asia/Kolkata), a 1–4 week cycle and the
actual approved local start/end hours. The UI offers the five requested weekday
patterns as editable suggestions: Mon–Wed, Thu–Sat, Mon–Tue, Wed–Thu and Fri–Sat.
The times are **not** invented or fixed in source code. SQL rejects overlapping
slots in the same cycle.

## Generate due work

The [calendar API](../../src/app/api/calendar/schedules/[id]/run/route.ts) or
[authorized runner](../../scripts/lib/recurring-runner.mjs) calls
`run_due_recurring_schedule` in [calendar SQL](../../supabase/migrations/20261028001300_recurring_calendar.sql).
That function checks calendar management and `weekly_test` CREATE for the selected
sections, then uses the existing section Activity publisher. A unique occurrence
key plus row locks make repeated runs idempotent. Published assignments and
notifications use the shared Activity model; no online-test engine is added.

The local command [run-recurring-local](../../scripts/run-recurring-local.mjs)
was tested with a synthetic approved account. The optional
[hosted entry point](../../scripts/run-recurring-hosted.mjs) requires explicit
enablement and a restricted existing staff sign-in, then runs a short horizon.
It **does not schedule itself**. The inactive [systemd timer](../../deploy/systemd/arkst-calendar.timer)
is only an example; an approved always-on host, secrets and monitoring must be set
up and tested.

## Exam blackout behavior

An active blackout records exact UTC start/end instants. If a future test window
overlaps it, the runner records a blocked occurrence **without** creating an
Activity, assignment, reminder or outbox job. A blackout entered after an Activity
was already published shows a conflict for staff; it does not delete or silently
change that work. Removing a blackout also does not silently publish a previously
blocked instance: authorized staff must decide whether to requeue or skip it.
An announcement that there are no tests is a separate authorized informational
publication and creates no completion task.

## Date and permission cautions

The manager enters local clock times, while publication and blackout comparison
use absolute instants. Review timezone and day boundaries carefully. A calendar
grant does not imply category CREATE, private supervision or counselor access.
Manual NPTEL Activities keep their individually chosen dates and can have
creator-authorized audited deadline changes.

Run `npm run check`, `npm run test:rls`, and `npm run test:local -- session2` after
calendar changes. Those tests cover overlap, blackout, idempotence and denied
roles in the isolated local stack; a real hosted timer and delivery require
separate observation.
