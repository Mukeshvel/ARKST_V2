import { describe, expect, it } from 'vitest';
import {
  activityState,
  type Activity,
  type Assignment,
} from './dashboard-data';

const activity: Activity = {
  id: 'activity',
  title: 'Test',
  description: '',
  category_key: 'general',
  scope_id: 'scope',
  starts_at: '2026-10-27T10:00:00.000Z',
  deadline_at: '2026-10-27T12:00:00.000Z',
  ends_at: '2026-10-27T13:00:00.000Z',
  requires_verification: true,
  created_at: '2026-10-27T09:00:00.000Z',
  created_by: 'staff',
};
const assignment: Assignment = {
  id: 'assignment',
  student_id: 'student',
  assigned_at: '2026-10-27T09:00:00.000Z',
  completion: null,
};

describe('student Activity state shown from persisted fields', () => {
  it('uses the inclusive start and exclusive deadline for unreported work', () => {
    expect(
      activityState(
        activity,
        assignment,
        Date.parse('2026-10-27T09:59:59.999Z'),
      ),
    ).toBe('upcoming');
    expect(
      activityState(activity, assignment, Date.parse(activity.starts_at)),
    ).toBe('current');
    expect(
      activityState(activity, assignment, Date.parse(activity.deadline_at)),
    ).toBe('overdue');
  });

  it('keeps a verification-required report awaiting even after the deadline', () => {
    const reported: Assignment = {
      ...assignment,
      completion: {
        state: 'reported',
        submitted_at: activity.starts_at,
        verified_at: null,
      },
    };
    expect(
      activityState(activity, reported, Date.parse(activity.ends_at)),
    ).toBe('awaiting');
    expect(
      activityState(
        { ...activity, requires_verification: false },
        reported,
        Date.parse(activity.ends_at),
      ),
    ).toBe('reported');
    expect(
      activityState(
        activity,
        {
          ...reported,
          completion: {
            ...reported.completion!,
            state: 'verified',
            verified_at: activity.ends_at,
          },
        },
        Date.parse(activity.ends_at),
      ),
    ).toBe('verified');
  });
});
