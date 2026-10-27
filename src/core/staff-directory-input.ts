export class DirectoryError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function directoryOffset(url: string): number {
  const query = new URL(url).searchParams;
  const value = query.get('offset') ?? '0';
  if (
    [...query.keys()].some((key) => key !== 'offset') ||
    query.getAll('offset').length > 1 ||
    !/^\d{1,5}$/.test(value) ||
    Number(value) > 10000
  )
    throw new DirectoryError(
      400,
      'Only an offset from 0 to 10000 is accepted.',
    );
  return Number(value);
}

export function staffDirectoryInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new DirectoryError(400, 'Expected an object.');
  const data = value as Record<string, unknown>;
  const allowed = ['teachingStatus', 'designation', 'subjects', 'sectionIds'];
  if (Object.keys(data).some((k) => !allowed.includes(k)))
    throw new DirectoryError(400, 'Unsupported field.');
  if (
    !['teaching', 'non_teaching'].includes(String(data.teachingStatus)) ||
    typeof data.designation !== 'string' ||
    data.designation.trim().length > 120 ||
    !Array.isArray(data.subjects) ||
    data.subjects.length > 20 ||
    !data.subjects.every(
      (x) =>
        typeof x === 'string' && x.trim().length > 0 && x.trim().length <= 100,
    ) ||
    new Set((data.subjects as string[]).map((x) => x.trim().toLowerCase()))
      .size !== (data.subjects as string[]).length ||
    !Array.isArray(data.sectionIds) ||
    data.sectionIds.length > 100 ||
    !(data.sectionIds as unknown[]).every(
      (x) =>
        typeof x === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          x,
        ),
    ) ||
    new Set(data.sectionIds).size !== data.sectionIds.length
  )
    throw new DirectoryError(
      400,
      'Invalid teaching status, designation, subjects or section preferences.',
    );
  return {
    p_teaching_status: data.teachingStatus as string,
    p_designation: data.designation.trim(),
    p_subjects: (data.subjects as string[]).map((x) => x.trim()),
    p_section_ids: (data.sectionIds as string[]).map((x) => x.toLowerCase()),
  };
}

export function directoryJson(value: unknown) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length > 0
  )
    throw new DirectoryError(400, 'Expected an empty JSON object.');
}
