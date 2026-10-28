/** Run only schedules visible to the authenticated, separately granted operator. */
export function scheduleThroughDate(timezone, horizonDays, now = new Date()) {
  if (!Number.isInteger(horizonDays) || horizonDays < 0 || horizonDays > 28)
    throw new Error('Runner horizon must be 0–28 days.');
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  const date = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + horizonDays);
  return date.toISOString().slice(0, 10);
}
export async function runAuthorizedSchedules(
  client,
  { horizonDays = null } = {},
) {
  const grants = await client.rpc('department_operation_options');
  if (grants.error || !Array.isArray(grants.data))
    throw new Error('Calendar grants could not be loaded.');
  let schedules = 0,
    published = 0,
    blocked = 0,
    existing = 0;
  for (const department of grants.data.filter((row) => row.manageCalendar)) {
    const overview = await client.rpc('calendar_overview', {
      p_department: department.departmentId,
    });
    if (overview.error || !Array.isArray(overview.data?.schedules))
      throw new Error('Calendar overview failed for an approved department.');
    for (const schedule of overview.data.schedules.filter(
      (row) => !row.paused,
    )) {
      const args = { p_schedule: schedule.id };
      if (horizonDays !== null)
        args.p_through = scheduleThroughDate(schedule.timezone, horizonDays);
      const run = await client.rpc('run_due_recurring_schedule', args);
      if (run.error || !run.data || typeof run.data.published !== 'number')
        throw new Error(
          `Recurring generation failed; database code ${run.error?.code ?? 'unavailable'}.`,
        );
      schedules++;
      published += run.data.published;
      blocked += run.data.blocked;
      existing += run.data.existing;
    }
  }
  return { schedules, published, blocked, existing };
}
