export class ActivityError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function activityId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new ActivityError(400, 'Expected a UUID.');
  return value.toLowerCase();
}

export function followUpInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ActivityError(400, 'Expected a follow-up object.');
  const data = value as Record<string, unknown>;
  if (
    Object.keys(data).some(
      (key) => !['assignmentIds', 'reason'].includes(key),
    ) ||
    !Array.isArray(data.assignmentIds) ||
    data.assignmentIds.length < 1 ||
    data.assignmentIds.length > 100 ||
    typeof data.reason !== 'string' ||
    data.reason.trim().length < 1 ||
    data.reason.trim().length > 500
  )
    throw new ActivityError(400, 'Invalid follow-up request.');
  const assignmentIds = data.assignmentIds.map(activityId);
  if (new Set(assignmentIds).size !== assignmentIds.length)
    throw new ActivityError(400, 'Duplicate assignments are not accepted.');
  return { p_assignments: assignmentIds, p_reason: data.reason.trim() };
}

export function followUpSelection(url: string) {
  const query = new URL(url).searchParams;
  if (
    [...query.keys()].some((key) => key !== 'assignment') ||
    query.getAll('assignment').length > 50
  )
    throw new ActivityError(400, 'Invalid assignment selection.');
  return [...new Set(query.getAll('assignment').map(activityId))];
}

export function followUpResolutionInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ActivityError(400, 'Expected a resolution object.');
  const data = value as Record<string, unknown>;
  if (
    Object.keys(data).some((key) => key !== 'note') ||
    typeof data.note !== 'string' ||
    data.note.trim().length < 1 ||
    data.note.trim().length > 500
  )
    throw new ActivityError(400, 'A resolution note is required.');
  return { p_note: data.note.trim() };
}

export function catchUpRequestInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ActivityError(400, 'Expected a catch-up request object.');
  const data = value as Record<string, unknown>;
  if (
    Object.keys(data).some(
      (key) => !['subject', 'missedInformation'].includes(key),
    ) ||
    typeof data.subject !== 'string' ||
    data.subject.trim().length < 1 ||
    data.subject.trim().length > 160 ||
    typeof data.missedInformation !== 'string' ||
    data.missedInformation.trim().length < 1 ||
    data.missedInformation.trim().length > 3000
  )
    throw new ActivityError(400, 'Invalid catch-up request.');
  return {
    p_subject: data.subject.trim(),
    p_information: data.missedInformation.trim(),
  };
}

export function catchUpReviewInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ActivityError(400, 'Expected a review decision.');
  const data = value as Record<string, unknown>;
  if (
    Object.keys(data).some((key) => !['approve', 'reason'].includes(key)) ||
    typeof data.approve !== 'boolean' ||
    (data.approve && data.reason !== undefined) ||
    (!data.approve &&
      (typeof data.reason !== 'string' ||
        data.reason.trim().length < 1 ||
        data.reason.trim().length > 500))
  )
    throw new ActivityError(
      400,
      'Rejection requires a reason; approval does not.',
    );
  return {
    p_approve: data.approve,
    p_reason: data.approve ? null : (data.reason as string).trim(),
  };
}

export function escalationInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ActivityError(400, 'Expected an escalation request.');
  const data = value as Record<string, unknown>;
  if (
    Object.keys(data).some(
      (key) => !['assignmentId', 'reason'].includes(key),
    ) ||
    typeof data.reason !== 'string' ||
    data.reason.trim().length < 1 ||
    data.reason.trim().length > 500
  )
    throw new ActivityError(400, 'An escalation reason is required.');
  return {
    p_assignment: activityId(data.assignmentId),
    p_reason: data.reason.trim(),
  };
}

function instant(value: unknown): string {
  // Explicit UTC only; round-trip validation rejects impossible calendar dates.
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value)
  )
    throw new ActivityError(400, 'Dates must be explicit UTC ISO instants.');
  const time = new Date(value);
  if (
    !Number.isFinite(time.getTime()) ||
    time.toISOString() !== value.replace(/(?<!\.\d{3})Z$/, '.000Z')
  )
    throw new ActivityError(400, 'Invalid calendar date.');
  return time.toISOString();
}

export function activityInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ActivityError(400, 'Expected an activity object.');
  const data = value as Record<string, unknown>;
  const keys = [
    'category',
    'scopeId',
    'title',
    'description',
    'startsAt',
    'deadlineAt',
    'endsAt',
    'requiresVerification',
    'studentIds',
  ];
  if (Object.keys(data).some((key) => !keys.includes(key)))
    throw new ActivityError(
      400,
      'Unsupported activity field or targeting mode.',
    );
  if (
    typeof data.title !== 'string' ||
    !data.title.trim() ||
    data.title.trim().length > 160 ||
    typeof data.description !== 'string' ||
    data.description.length > 5000 ||
    typeof data.category !== 'string' ||
    !/^[a-z][a-z0-9_]{0,49}$/.test(data.category) ||
    typeof data.requiresVerification !== 'boolean' ||
    !Array.isArray(data.studentIds) ||
    data.studentIds.length < 1 ||
    data.studentIds.length > 500
  )
    throw new ActivityError(400, 'Invalid activity fields.');
  const students = data.studentIds.map(activityId);
  if (new Set(students).size !== students.length)
    throw new ActivityError(400, 'Duplicate student targets are not accepted.');
  const startsAt = instant(data.startsAt);
  const deadlineAt = instant(data.deadlineAt);
  const endsAt = instant(data.endsAt);
  if (!(startsAt < deadlineAt && deadlineAt <= endsAt))
    throw new ActivityError(
      400,
      'Require start before deadline and deadline at or before end.',
    );
  return {
    p_category: data.category,
    p_scope: activityId(data.scopeId),
    p_title: data.title.trim(),
    p_description: data.description,
    p_starts_at: startsAt,
    p_deadline_at: deadlineAt,
    p_ends_at: endsAt,
    p_requires_verification: data.requiresVerification,
    p_students: students,
  };
}

export function activityOffset(url: string): number {
  const query = new URL(url).searchParams;
  const value = query.get('offset') ?? '0';
  if (
    [...query.keys()].some((key) => key !== 'offset') ||
    query.getAll('offset').length > 1 ||
    !/^\d{1,6}$/.test(value)
  )
    throw new ActivityError(400, 'Only a numeric offset is accepted.');
  return Number(value);
}

export function sectionActivityInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ActivityError(400, 'Expected a section Activity object.');
  const data = value as Record<string, unknown>;
  const keys = [
    'category',
    'departmentScopeId',
    'sectionIds',
    'title',
    'description',
    'startsAt',
    'deadlineAt',
    'endsAt',
    'requiresVerification',
  ];
  if (Object.keys(data).some((key) => !keys.includes(key)))
    throw new ActivityError(400, 'Unsupported section Activity field.');
  if (
    typeof data.title !== 'string' ||
    !data.title.trim() ||
    data.title.trim().length > 160 ||
    typeof data.description !== 'string' ||
    data.description.length > 5000 ||
    typeof data.category !== 'string' ||
    !/^[a-z][a-z0-9_]{0,49}$/.test(data.category) ||
    typeof data.requiresVerification !== 'boolean' ||
    !Array.isArray(data.sectionIds) ||
    data.sectionIds.length < 1 ||
    data.sectionIds.length > 20
  )
    throw new ActivityError(400, 'Invalid section Activity fields.');
  const sections = data.sectionIds.map(activityId);
  if (new Set(sections).size !== sections.length)
    throw new ActivityError(400, 'Duplicate section targets are not accepted.');
  const startsAt = instant(data.startsAt);
  const deadlineAt = instant(data.deadlineAt);
  const endsAt = instant(data.endsAt);
  if (!(startsAt < deadlineAt && deadlineAt <= endsAt))
    throw new ActivityError(
      400,
      'Require start before deadline and deadline at or before end.',
    );
  return {
    p_category: data.category,
    p_department: activityId(data.departmentScopeId),
    p_sections: sections,
    p_title: data.title.trim(),
    p_description: data.description,
    p_starts_at: startsAt,
    p_deadline_at: deadlineAt,
    p_ends_at: endsAt,
    p_requires_verification: data.requiresVerification,
  };
}

export function selectedActivityInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ActivityError(400, 'Expected a selected Activity object.');
  const data = value as Record<string, unknown>;
  const keys = [
    'category',
    'departmentScopeId',
    'studentIds',
    'counselingOnly',
    'title',
    'description',
    'startsAt',
    'deadlineAt',
    'endsAt',
    'requiresVerification',
  ];
  if (Object.keys(data).some((key) => !keys.includes(key)))
    throw new ActivityError(400, 'Unsupported selected Activity field.');
  if (
    typeof data.counselingOnly !== 'boolean' ||
    typeof data.title !== 'string' ||
    !data.title.trim() ||
    data.title.trim().length > 160 ||
    typeof data.description !== 'string' ||
    data.description.length > 5000 ||
    typeof data.category !== 'string' ||
    !/^[a-z][a-z0-9_]{0,49}$/.test(data.category) ||
    typeof data.requiresVerification !== 'boolean' ||
    !Array.isArray(data.studentIds) ||
    data.studentIds.length < 1 ||
    data.studentIds.length > 500
  )
    throw new ActivityError(400, 'Invalid selected Activity fields.');
  const students = data.studentIds.map(activityId);
  if (new Set(students).size !== students.length)
    throw new ActivityError(400, 'Duplicate student targets are not accepted.');
  const startsAt = instant(data.startsAt);
  const deadlineAt = instant(data.deadlineAt);
  const endsAt = instant(data.endsAt);
  if (!(startsAt < deadlineAt && deadlineAt <= endsAt))
    throw new ActivityError(
      400,
      'Require start before deadline and deadline at or before end.',
    );
  return {
    p_category: data.category,
    p_department: activityId(data.departmentScopeId),
    p_students: students,
    p_counseling_only: data.counselingOnly,
    p_title: data.title.trim(),
    p_description: data.description,
    p_starts_at: startsAt,
    p_deadline_at: deadlineAt,
    p_ends_at: endsAt,
    p_requires_verification: data.requiresVerification,
  };
}

export function candidateInput(url: string) {
  const query = new URL(url).searchParams;
  if (
    [...query.keys()].some(
      (key) =>
        ![
          'department',
          'category',
          'counselingOnly',
          'search',
          'offset',
        ].includes(key),
    ) ||
    [...query.keys()].some((key) => query.getAll(key).length > 1)
  )
    throw new ActivityError(400, 'Unsupported candidate query.');
  const category = query.get('category');
  const only = query.get('counselingOnly') ?? 'false';
  const search = query.get('search') ?? '';
  const offset = query.get('offset') ?? '0';
  if (
    !category ||
    !/^[a-z][a-z0-9_]{0,49}$/.test(category) ||
    !['true', 'false'].includes(only) ||
    search.length > 80 ||
    !/^\d{1,5}$/.test(offset) ||
    Number(offset) > 10000
  )
    throw new ActivityError(400, 'Invalid candidate query.');
  return {
    p_department: activityId(query.get('department')),
    p_category: category,
    p_counseling_only: only === 'true',
    p_search: search,
    p_offset: Number(offset),
  };
}

export function announcementInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ActivityError(400, 'Expected an announcement object.');
  const data = value as Record<string, unknown>;
  const keys = [
    'departmentScopeId',
    'mode',
    'sectionIds',
    'studentIds',
    'title',
    'message',
  ];
  if (
    Object.keys(data).some((key) => !keys.includes(key)) ||
    !['sections', 'selected', 'counseling'].includes(String(data.mode)) ||
    typeof data.title !== 'string' ||
    !data.title.trim() ||
    data.title.trim().length > 160 ||
    typeof data.message !== 'string' ||
    !data.message.trim() ||
    data.message.trim().length > 5000
  )
    throw new ActivityError(400, 'Invalid announcement fields.');
  const sectionMode = data.mode === 'sections';
  const raw = sectionMode ? data.sectionIds : data.studentIds;
  if (
    !Array.isArray(raw) ||
    raw.length < 1 ||
    raw.length > (sectionMode ? 20 : 500) ||
    (sectionMode
      ? data.studentIds !== undefined
      : data.sectionIds !== undefined)
  )
    throw new ActivityError(400, 'Invalid announcement audience.');
  const ids = raw.map(activityId);
  if (new Set(ids).size !== ids.length)
    throw new ActivityError(
      400,
      'Duplicate announcement targets are not accepted.',
    );
  return {
    p_department: activityId(data.departmentScopeId),
    p_mode: data.mode as string,
    p_sections: sectionMode ? ids : null,
    p_students: sectionMode ? null : ids,
    p_title: data.title.trim(),
    p_message: data.message.trim(),
  };
}

export function pendingView(url: string) {
  const query = new URL(url).searchParams;
  if (
    [...query.keys()].some((key) => key !== 'view') ||
    query.getAll('view').length !== 1 ||
    !['creator', 'counselor'].includes(query.get('view') ?? '')
  )
    throw new ActivityError(400, 'Expected creator or counselor view.');
  return query.get('view') === 'counselor';
}

export function notificationOffset(url: string) {
  const query = new URL(url).searchParams;
  const value = query.get('offset') ?? '0';
  if (
    [...query.keys()].some((key) => key !== 'offset') ||
    query.getAll('offset').length > 1 ||
    !/^\d{1,5}$/.test(value) ||
    Number(value) > 10000
  )
    throw new ActivityError(400, 'Only an offset from 0 to 10000 is accepted.');
  return Number(value);
}
