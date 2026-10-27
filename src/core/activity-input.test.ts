import { describe, expect, it } from 'vitest';
import { activityInput, activityOffset } from './activity-input';

const valid = {
  category: 'general',
  scopeId: '10000000-0000-4000-8000-000000000001',
  title: 'A real task',
  description: '',
  startsAt: '2026-10-27T10:00:00Z',
  deadlineAt: '2026-10-28T10:00:00Z',
  endsAt: '2026-10-28T11:00:00.000Z',
  requiresVerification: true,
  studentIds: ['20000000-0000-4000-8000-000000000001'],
};

describe('activity boundary input', () => {
  it('accepts configurable UTC windows and extensible category keys', () => {
    expect(
      activityInput({ ...valid, category: 'future_category' }).p_starts_at,
    ).toBe('2026-10-27T10:00:00.000Z');
  });
  it.each([
    { startsAt: '2026-02-30T10:00:00Z' },
    { startsAt: '2026-10-27' },
    { startsAt: '2026-10-27T10:00:00+05:30' },
    { startsAt: valid.deadlineAt },
    { endsAt: valid.startsAt },
    { deadlineAt: 'infinity' },
    { studentIds: [] },
    { studentIds: [...valid.studentIds, ...valid.studentIds] },
    { studentIds: ['invalid'] },
    { title: ' ' },
    { requiresVerification: 'false' },
    { createdBy: valid.studentIds[0] },
    { groupIds: valid.studentIds },
    { scopeId: null },
    { description: 'x'.repeat(5001) },
  ])('rejects invalid or privileged fields: %j', (change) => {
    expect(() => activityInput({ ...valid, ...change })).toThrow();
  });
  it('bounds and validates pagination without allowing identity filters', () => {
    expect(activityOffset('http://localhost/api/activities?offset=50')).toBe(
      50,
    );
    for (const query of [
      'offset=-1',
      'offset=1&offset=2',
      'studentId=anything',
      'offset=Infinity',
    ])
      expect(() =>
        activityOffset(`http://localhost/api/activities?${query}`),
      ).toThrow();
  });
});
