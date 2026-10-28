import { ActivityError, activityId } from './activity-input';

function object(value: unknown, keys: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ActivityError(400, 'Expected a calendar object.');
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some((key) => !keys.includes(key)))
    throw new ActivityError(400, 'Unsupported calendar field.');
  return data;
}
function text(value: unknown, max: number, required = true) {
  if (
    typeof value !== 'string' ||
    value.length > max ||
    (required && !value.trim())
  )
    throw new ActivityError(400, 'Invalid calendar text.');
  return value.trim();
}
function int(value: unknown, min: number, max: number) {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  )
    throw new ActivityError(400, 'Invalid calendar number.');
  return value;
}
function bool(value: unknown) {
  if (typeof value !== 'boolean')
    throw new ActivityError(400, 'Expected true or false.');
  return value;
}
function date(value: unknown) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ||
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
  )
    throw new ActivityError(400, 'Expected a valid ISO date.');
  return value;
}
function time(value: unknown) {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
    throw new ActivityError(400, 'Expected a local 24-hour HH:mm time.');
  return value;
}
export function utcInstant(value: unknown) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  )
    throw new ActivityError(400, 'Expected an explicit UTC instant.');
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value)
    throw new ActivityError(400, 'Invalid UTC instant.');
  return value;
}
function ids(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20)
    throw new ActivityError(400, 'Select 1 to 20 sections.');
  const list = value.map(activityId);
  if (new Set(list).size !== list.length)
    throw new ActivityError(400, 'Duplicate sections are not accepted.');
  return list;
}
export function scheduleCreateInput(value: unknown) {
  const d = object(value, [
    'departmentId',
    'name',
    'description',
    'timezone',
    'anchorMonday',
    'cycleWeeks',
    'sectionIds',
  ]);
  return {
    p_department: activityId(d.departmentId),
    p_name: text(d.name, 120),
    p_description: text(d.description, 1000, false),
    p_timezone: text(d.timezone, 80),
    p_anchor_monday: date(d.anchorMonday),
    p_cycle_weeks: int(d.cycleWeeks, 1, 4),
    p_sections: ids(d.sectionIds),
  };
}
export function scheduleConfigureInput(value: unknown) {
  const d = object(value, ['name', 'description', 'sectionIds']);
  return {
    p_name: text(d.name, 120),
    p_description: text(d.description, 1000, false),
    p_sections: ids(d.sectionIds),
  };
}
export function slotInput(value: unknown) {
  const d = object(value, [
    'position',
    'weekOffset',
    'startDay',
    'endDay',
    'startTime',
    'endTime',
    'title',
    'description',
    'requiresVerification',
    'active',
  ]);
  return {
    p_position: int(d.position, 1, 20),
    p_week_offset: int(d.weekOffset, 0, 3),
    p_start_day: int(d.startDay, 0, 6),
    p_end_day: int(d.endDay, 0, 6),
    p_start_time: time(d.startTime),
    p_end_time: time(d.endTime),
    p_title: text(d.title, 160),
    p_description: text(d.description, 5000, false),
    p_requires_verification: bool(d.requiresVerification),
    p_active: bool(d.active),
  };
}
export function pausedInput(value: unknown) {
  return { p_paused: bool(object(value, ['paused']).paused) };
}
export function activeInput(value: unknown) {
  return { p_active: bool(object(value, ['active']).active) };
}
export function blackoutInput(value: unknown) {
  const d = object(value, ['departmentId', 'reason', 'startsAt', 'endsAt']);
  const start = utcInstant(d.startsAt),
    end = utcInstant(d.endsAt);
  if (start >= end)
    throw new ActivityError(400, 'Blackout end must follow start.');
  return {
    p_department: activityId(d.departmentId),
    p_reason: text(d.reason, 500),
    p_starts_at: start,
    p_ends_at: end,
  };
}
export function decisionInput(value: unknown) {
  const d = object(value, ['decision']);
  if (d.decision !== 'skip' && d.decision !== 'requeue')
    throw new ActivityError(400, 'Expected skip or requeue.');
  return { p_decision: d.decision };
}
export function windowInput(value: unknown) {
  const d = object(value, ['deadlineAt', 'endsAt']);
  const deadline = utcInstant(d.deadlineAt),
    end = utcInstant(d.endsAt);
  if (deadline > end)
    throw new ActivityError(400, 'Deadline must not follow end.');
  return { p_deadline_at: deadline, p_ends_at: end };
}
export function departmentQuery(url: string) {
  const q = new URL(url).searchParams;
  if (
    [...q.keys()].some((key) => key !== 'department') ||
    q.getAll('department').length !== 1
  )
    throw new ActivityError(400, 'Expected one department.');
  return activityId(q.get('department'));
}
export function supervisionActivityQuery(url: string) {
  const parsed = new URL(url);
  const ids = parsed.searchParams.getAll('activity');
  if (ids.length > 1) throw new ActivityError(400, 'Invalid Activity filter.');
  parsed.searchParams.delete('activity');
  return {
    ...supervisionQuery(parsed.toString()),
    p_activity: ids.length ? activityId(ids[0]) : null,
  };
}
export function supervisionQuery(url: string) {
  const q = new URL(url).searchParams;
  if (
    [...q.keys()].some(
      (key) => !['department', 'section', 'offset'].includes(key),
    ) ||
    [...q.keys()].some((key) => q.getAll(key).length > 1)
  )
    throw new ActivityError(400, 'Invalid supervision query.');
  const offset = q.get('offset') ?? '0';
  if (!/^\d{1,5}$/.test(offset) || Number(offset) > 10000)
    throw new ActivityError(400, 'Invalid supervision offset.');
  return {
    p_department: activityId(q.get('department')),
    p_section: q.get('section') ? activityId(q.get('section')) : null,
    p_offset: Number(offset),
  };
}
export function supervisionStudentQuery(url: string) {
  const q = new URL(url).searchParams;
  if (
    [...q.keys()].some((key) => !['department', 'offset'].includes(key)) ||
    [...q.keys()].some((key) => q.getAll(key).length > 1)
  )
    throw new ActivityError(400, 'Invalid student detail query.');
  const offset = q.get('offset') ?? '0';
  if (!/^\d{1,5}$/.test(offset) || Number(offset) > 10000)
    throw new ActivityError(400, 'Invalid student detail offset.');
  return {
    p_department: activityId(q.get('department')),
    p_offset: Number(offset),
  };
}
export function runQuery(value: unknown) {
  const d = object(value, ['through']);
  return { p_through: d.through === undefined ? null : date(d.through) };
}
