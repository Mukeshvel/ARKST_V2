# `src/core/calendar-input.test.ts`

[Source](../../../../../src/core/calendar-input.test.ts)

## A. What is this file?

Unit tests for Activity supervision query parsing.

## B. Why does ARKST need it?

Rejects ambiguous Activity filters before a private report is requested.

## C. How does it work?

Checks optional Activity selection and offset parsing, malformed and duplicate parameters, unknown fields, and that the original supervision query still rejects Activity parameters.

## D. Which files does it connect to?

- [`src/core/calendar-input.ts`](../../../../../src/core/calendar-input.ts)

## E. What happens if I modify this file?

Changing expected inputs changes the API contract; do not relax malformed UUID or duplicate-field rejection.

## F. How do I verify a safe change?

npm test or npx vitest run src/core/calendar-input.test.ts (installed dependency).

## G. Important cautions

These pure tests do not prove database permissions; the local integration and SQL tests do that.
