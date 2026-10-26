import { describe, expect, it } from 'vitest';
import { isComplete, validateWindow, windowState } from './activity';

describe('completion accounting', () => {
  it.each([
    ['pending', false, false],
    ['pending', true, false],
    ['reported', false, true],
    ['reported', true, false],
    ['verified', false, true],
    ['verified', true, true],
  ] as const)(
    '%s with verification=%s => complete=%s',
    (status, required, result) => {
      expect(isComplete(status, required)).toBe(result);
    },
  );
});
describe('configurable activity windows', () => {
  const window = {
    opensAt: new Date('2026-10-26T09:00:00Z'),
    dueAt: new Date('2026-10-26T10:00:00Z'),
  };
  it.each([
    ['2026-10-26T08:59:59Z', 'upcoming'],
    ['2026-10-26T09:00:00Z', 'open'],
    ['2026-10-26T09:59:59Z', 'open'],
    ['2026-10-26T10:00:00Z', 'closed'],
    ['2026-10-26T11:00:00Z', 'closed'],
  ] as const)('classifies %s as %s', (now, result) =>
    expect(windowState(window, new Date(now))).toBe(result),
  );
  it('compares equivalent instants across offsets', () =>
    expect(windowState(window, new Date('2026-10-26T14:30:00+05:30'))).toBe(
      'open',
    ));
  it('rejects equal or reversed windows', () => {
    expect(() =>
      validateWindow({ opensAt: window.dueAt, dueAt: window.opensAt }),
    ).toThrow();
    expect(() =>
      validateWindow({ opensAt: window.dueAt, dueAt: window.dueAt }),
    ).toThrow();
  });
  it('rejects invalid instants', () => {
    expect(() =>
      validateWindow({ ...window, opensAt: new Date('invalid') }),
    ).toThrow();
    expect(() =>
      validateWindow({ ...window, dueAt: new Date('invalid') }),
    ).toThrow();
    expect(() => windowState(window, new Date('invalid'))).toThrow();
  });
});
