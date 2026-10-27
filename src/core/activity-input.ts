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
