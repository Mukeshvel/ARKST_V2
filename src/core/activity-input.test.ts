import { describe, expect, it } from 'vitest';
import {
  activityInput,
  activityOffset,
  selectedActivityInput,
  candidateInput,
  announcementInput,
  pendingView,
  notificationOffset,
} from './activity-input';

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

describe('operational targeting input', () => {
  const { scopeId, ...rest } = valid;
  const selected = {
    ...rest,
    departmentScopeId: scopeId,
    counselingOnly: false,
  };
  it('accepts one explicit selected audience with existing Activity dates', () => {
    const parsed = selectedActivityInput(selected);
    expect(parsed.p_students).toEqual(valid.studentIds);
    expect(parsed.p_department).toBe(valid.scopeId);
  });
  it('rejects duplicate, unbounded and client-controlled selected targeting', () => {
    for (const change of [
      { studentIds: [...valid.studentIds, ...valid.studentIds] },
      { studentIds: [] },
      { studentIds: Array(501).fill(valid.studentIds[0]) },
      { counselingOnly: 'true' },
      { scopeId: valid.scopeId },
      { startsAt: '2026-02-30T10:00:00Z' },
    ])
      expect(() => selectedActivityInput({ ...selected, ...change })).toThrow();
  });
  it('bounds roster search and rejects arbitrary selectors', () => {
    const base = `http://localhost/api/activities/candidates?department=${valid.scopeId}&category=general`;
    expect(
      candidateInput(`${base}&counselingOnly=true&offset=50`).p_counseling_only,
    ).toBe(true);
    for (const suffix of [
      '&studentId=x',
      '&offset=-1',
      `&search=${'x'.repeat(81)}`,
      '&counselingOnly=true&counselingOnly=false',
    ])
      expect(() => candidateInput(base + suffix)).toThrow();
  });
  it('keeps announcements separate and rejects ambiguous audiences', () => {
    const sections = {
      departmentScopeId: valid.scopeId,
      mode: 'sections',
      sectionIds: [valid.scopeId],
      title: 'No tests',
      message: 'Information only.',
    };
    expect(announcementInput(sections).p_students).toBeNull();
    expect(() =>
      announcementInput({ ...sections, studentIds: valid.studentIds }),
    ).toThrow();
    expect(() =>
      announcementInput({
        ...sections,
        sectionIds: [valid.scopeId, valid.scopeId],
      }),
    ).toThrow();
    expect(() => announcementInput({ ...sections, message: '' })).toThrow();
  });
  it('limits pending-copy view and inbox pagination', () => {
    expect(pendingView('http://localhost/pending?view=counselor')).toBe(true);
    expect(() =>
      pendingView('http://localhost/pending?view=student'),
    ).toThrow();
    expect(notificationOffset('http://localhost/notifications?offset=50')).toBe(
      50,
    );
    expect(() =>
      notificationOffset('http://localhost/notifications?offset=10001'),
    ).toThrow();
  });
});
