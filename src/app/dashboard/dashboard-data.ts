export type Completion = {
  state: 'reported' | 'verified';
  submitted_at: string;
  verified_at: string | null;
};

export type Assignment = {
  id: string;
  student_id: string;
  assigned_at: string;
  completion: Completion | null;
};

export type Activity = {
  id: string;
  title: string;
  description: string;
  category_key: string;
  scope_id: string;
  starts_at: string;
  deadline_at: string;
  ends_at: string;
  requires_verification: boolean;
  created_at: string;
  created_by: string;
  assignments?: Assignment[];
};

export type CreationOption = {
  department_id: string;
  department_name: string;
  section_id: string;
  section_name: string;
  category_key: string;
  category_label: string;
  eligible_count: number;
};

export type CreatorAssignment = {
  assignmentId: string;
  studentId: string;
  studentIdentifier: string | null;
  studentName: string | null;
  state: 'reported' | 'verified' | null;
  submittedAt: string | null;
  verifiedAt: string | null;
};

export type CreatorMonitor = {
  activityId: string;
  totalAssigned: number;
  selfReportedCompleted: number;
  awaitingVerification: number;
  verified: number;
  pending: number;
  overdue: number;
  assignments: CreatorAssignment[];
  offset: number;
  pageSize: number;
};

export type CounselorAssignment = {
  assignmentId: string;
  activityId: string;
  title: string;
  category: string;
  deadlineAt: string;
  requiresVerification: boolean;
  studentId: string;
  studentIdentifier: string;
  studentName: string;
  state: 'reported' | 'verified' | null;
  submittedAt: string | null;
  verifiedAt: string | null;
};

export type HistoryEvent = {
  id: number;
  assignment_id: string | null;
  action: 'created' | 'assigned' | 'reported' | 'verified';
  occurred_at: string;
};

export class DashboardRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function dashboardJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    cache: 'no-store',
  });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new DashboardRequestError(
      response.status,
      'The server returned an unreadable response. Reload before retrying.',
    );
  }
  if (!response.ok) {
    const message =
      body &&
      typeof body === 'object' &&
      'error' in body &&
      typeof body.error === 'string'
        ? body.error
        : 'The request failed. Reload before retrying.';
    throw new DashboardRequestError(response.status, message);
  }
  return body as T;
}

export function activityState(
  activity: Activity,
  assignment: Assignment,
  now = Date.now(),
): 'upcoming' | 'current' | 'overdue' | 'reported' | 'awaiting' | 'verified' {
  if (assignment.completion?.state === 'verified') return 'verified';
  if (assignment.completion?.state === 'reported')
    return activity.requires_verification ? 'awaiting' : 'reported';
  if (now < Date.parse(activity.starts_at)) return 'upcoming';
  if (now >= Date.parse(activity.deadline_at)) return 'overdue';
  return 'current';
}

export function readableState(state: ReturnType<typeof activityState>) {
  return {
    upcoming: 'Upcoming',
    current: 'Current',
    overdue: 'Overdue',
    reported: 'Self-reported complete',
    awaiting: 'Awaiting verification',
    verified: 'Verified',
  }[state];
}

export function formatWhen(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
