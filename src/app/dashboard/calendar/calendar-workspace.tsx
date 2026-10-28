'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { dashboardJson } from '../dashboard-data';

type Department = {
  departmentId: string;
  departmentName: string;
  manageCalendar: boolean;
};
type Section = { id: string; name: string };
type Slot = {
  id: string;
  position: number;
  title: string;
  weekOffset: number;
  startDay: number;
  endDay: number;
  startTime: string;
  endTime: string;
  description: string;
  requiresVerification: boolean;
  active: boolean;
};
type Schedule = {
  id: string;
  name: string;
  description: string;
  timezone: string;
  anchorMonday: string;
  cycleWeeks: number;
  paused: boolean;
  sections: string[];
  slots: Slot[];
};
type Blackout = {
  id: string;
  reason: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
};
type Conflict = {
  id: string;
  scheduleId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
  activityId: string | null;
  publishedOverlap: boolean;
};
type Instance = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
  activityId: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  generatedBy: string | null;
};
type Overview = {
  schedules: Schedule[];
  blackouts: Blackout[];
  conflicts: Conflict[];
  conflictsLimited: boolean;
};
const initialPattern = [
  { position: 1, weekOffset: 0, startDay: 0, endDay: 2, title: 'Test 1' },
  { position: 2, weekOffset: 0, startDay: 3, endDay: 5, title: 'Test 2' },
  { position: 3, weekOffset: 1, startDay: 0, endDay: 1, title: 'Test 3' },
  { position: 4, weekOffset: 1, startDay: 2, endDay: 3, title: 'Test 4' },
  { position: 5, weekOffset: 1, startDay: 4, endDay: 5, title: 'Test 5' },
];
function suggestedSlot(row: (typeof initialPattern)[number]): Slot {
  return {
    ...row,
    id: '',
    startTime: '',
    endTime: '',
    description: '',
    requiresVerification: false,
    active: true,
  };
}
const days = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'The request failed.';
}
function post(path: string, body: unknown) {
  return dashboardJson<Record<string, unknown>>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
function utc(value: FormDataEntryValue | null) {
  return new Date(String(value)).toISOString();
}

export function CalendarWorkspace() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [department, setDepartment] = useState('');
  const [sections, setSections] = useState<Section[]>([]);
  const [overview, setOverview] = useState<Overview>({
    schedules: [],
    blackouts: [],
    conflicts: [],
    conflictsLimited: false,
  });
  const [scheduleId, setScheduleId] = useState('');
  const [instances, setInstances] = useState<Instance[]>([]);
  const [instanceTotal, setInstanceTotal] = useState(0);
  const [instanceOffset, setInstanceOffset] = useState(0);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [slotDraft, setSlotDraft] = useState<Slot>(
    suggestedSlot(initialPattern[0]!),
  );
  const [slotStart, setSlotStart] = useState('');
  const [slotEnd, setSlotEnd] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const schedule = overview.schedules.find((row) => row.id === scheduleId);
  const load = useCallback(async (id: string) => {
    if (!id) return;
    const [sectionBody, calendar] = await Promise.all([
      dashboardJson<{ sections: Section[] }>(
        `/api/calendar/sections?department=${id}`,
      ),
      dashboardJson<Overview>(`/api/calendar?department=${id}`),
    ]);
    if (
      !Array.isArray(sectionBody.sections) ||
      !Array.isArray(calendar.schedules) ||
      !Array.isArray(calendar.blackouts) ||
      !Array.isArray(calendar.conflicts)
    )
      throw new Error('Calendar data is unavailable.');
    setSections(sectionBody.sections);
    setOverview(calendar);
    setScheduleId((current) =>
      calendar.schedules.some((row) => row.id === current)
        ? current
        : (calendar.schedules[0]?.id ?? ''),
    );
  }, []);
  const loadInstances = useCallback(async (id: string, offset: number) => {
    if (!id) {
      setInstances([]);
      setInstanceTotal(0);
      return;
    }
    const body = await dashboardJson<{ instances: Instance[]; total: number }>(
      `/api/calendar/schedules/${id}/instances?offset=${offset}`,
    );
    if (!Array.isArray(body.instances) || typeof body.total !== 'number')
      throw new Error('Instance history is unavailable.');
    setInstances(body.instances);
    setInstanceTotal(body.total);
    setInstanceOffset(offset);
  }, []);
  useEffect(() => {
    void dashboardJson<{ departments: Department[] }>(
      '/api/department-operations',
    )
      .then((body) => {
        const allowed = body.departments.filter((row) => row.manageCalendar);
        setDepartments(allowed);
        setDepartment(allowed[0]?.departmentId ?? '');
      })
      .catch((caught) => setError(errorText(caught)));
  }, []);
  useEffect(() => {
    void load(department).catch((caught) => setError(errorText(caught)));
  }, [department, load]);
  useEffect(() => {
    setSelectedSections(schedule?.sections ?? []);
  }, [scheduleId, schedule?.sections?.join(',')]);
  useEffect(() => {
    void loadInstances(scheduleId, 0).catch((caught) =>
      setError(errorText(caught)),
    );
  }, [scheduleId, loadInstances]);
  async function run(operation: () => Promise<string>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await operation();
      setNotice(result);
      await load(department);
      if (scheduleId) await loadInstances(scheduleId, 0);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }
  function toggleSection(id: string) {
    setSelectedSections((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    await run(async () => {
      const response = await post('/api/calendar/schedules', {
        departmentId: department,
        name: form.get('name'),
        description: form.get('description'),
        timezone: form.get('timezone'),
        anchorMonday: form.get('anchorMonday'),
        cycleWeeks: Number(form.get('cycleWeeks')),
        sectionIds: selectedSections,
      });
      if (typeof response.id !== 'string')
        throw new Error('Schedule creation result is unavailable.');
      setScheduleId(response.id);
      element.reset();
      return 'Schedule created paused. Add slots before resuming.';
    });
  }
  async function configure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(async () => {
      await post(`/api/calendar/schedules/${scheduleId}/configure`, {
        name: form.get('name'),
        description: form.get('description'),
        sectionIds: selectedSections,
      });
      return 'Schedule settings saved. Published Activities were not changed.';
    });
  }
  async function saveSlot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(async () => {
      await post(`/api/calendar/schedules/${scheduleId}/slots`, {
        ...slotDraft,
        startTime: slotStart,
        endTime: slotEnd,
        title: form.get('title'),
        description: form.get('description'),
        requiresVerification: form.get('requiresVerification') === 'on',
        active: form.get('active') === 'on',
      });
      return 'Slot saved. Existing published instances were not changed.';
    });
  }
  async function createBlackout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    await run(async () => {
      await post('/api/calendar/blackouts', {
        departmentId: department,
        reason: form.get('reason'),
        startsAt: utc(form.get('startsAt')),
        endsAt: utc(form.get('endsAt')),
      });
      element.reset();
      return 'Blackout saved. Check conflicts for already published Activities.';
    });
  }
  if (!departments.length)
    return (
      <section className="dashboard-panel">
        <p>
          {error ||
            'No calendar-management grant is available for this account.'}
        </p>
      </section>
    );
  return (
    <div className="dashboard-stack">
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <section className="dashboard-panel dashboard-stack">
        <label>
          Department{' '}
          <select
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value);
              setScheduleId('');
            }}
          >
            {departments.map((row) => (
              <option key={row.departmentId} value={row.departmentId}>
                {row.departmentName}
              </option>
            ))}
          </select>
        </label>
        <h2>New recurring schedule</h2>
        <p>
          Set the start Monday and a two-week cycle for the initial five-test
          pattern. Windows use the schedule timezone.
        </p>
        <form className="dashboard-form" onSubmit={create}>
          <div className="dashboard-form-grid">
            <label>
              Name <input name="name" required maxLength={120} />
            </label>
            <label>
              Timezone{' '}
              <input name="timezone" required defaultValue="Asia/Kolkata" />
            </label>
            <label>
              Cycle start Monday{' '}
              <input name="anchorMonday" type="date" required />
            </label>
            <label>
              Cycle weeks{' '}
              <input
                name="cycleWeeks"
                type="number"
                min={1}
                max={4}
                defaultValue={2}
                required
              />
            </label>
          </div>
          <label>
            Description <textarea name="description" maxLength={1000} />
          </label>
          <fieldset>
            <legend>Target sections</legend>
            {sections.map((row) => (
              <label className="dashboard-checkbox" key={row.id}>
                <input
                  type="checkbox"
                  checked={selectedSections.includes(row.id)}
                  onChange={() => toggleSection(row.id)}
                />
                {row.name}
              </label>
            ))}
          </fieldset>
          <button disabled={busy || !selectedSections.length} type="submit">
            Create paused schedule
          </button>
        </form>
      </section>
      <section className="dashboard-panel dashboard-stack">
        <h2>Schedules</h2>
        <label>
          Selected schedule{' '}
          <select
            value={scheduleId}
            onChange={(e) => setScheduleId(e.target.value)}
          >
            {overview.schedules.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name} · {row.paused ? 'Paused' : 'Active'}
              </option>
            ))}
          </select>
        </label>
        {schedule && (
          <>
            <p>
              {schedule.timezone} · {schedule.cycleWeeks}-week cycle from{' '}
              {schedule.anchorMonday}
            </p>
            <form
              className="dashboard-form"
              key={schedule.id}
              onSubmit={configure}
            >
              <div className="dashboard-form-grid">
                <label>
                  Name{' '}
                  <input
                    name="name"
                    required
                    maxLength={120}
                    defaultValue={schedule.name}
                  />
                </label>
              </div>
              <label>
                Description{' '}
                <textarea
                  name="description"
                  maxLength={1000}
                  defaultValue={schedule.description}
                />
              </label>
              <fieldset>
                <legend>Sections for future instances</legend>
                {sections.map((row) => (
                  <label className="dashboard-checkbox" key={row.id}>
                    <input
                      type="checkbox"
                      checked={selectedSections.includes(row.id)}
                      onChange={() => toggleSection(row.id)}
                    />
                    {row.name}
                  </label>
                ))}
              </fieldset>
              <button disabled={busy || !selectedSections.length} type="submit">
                Save schedule
              </button>
            </form>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await post(`/api/calendar/schedules/${schedule.id}/pause`, {
                    paused: !schedule.paused,
                  });
                  return schedule.paused
                    ? 'Schedule resumed.'
                    : 'Schedule paused.';
                })
              }
            >
              {schedule.paused ? 'Resume' : 'Pause'}
            </button>
            <h3>Test windows</h3>
            {schedule.slots.map((slot) => (
              <div className="dashboard-list-row" key={slot.id}>
                <span>
                  #{slot.position} {slot.title} · week {slot.weekOffset + 1},{' '}
                  {days[slot.startDay]} {slot.startTime} to {days[slot.endDay]}{' '}
                  {slot.endTime} · {slot.active ? 'Active' : 'Inactive'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSlotDraft(slot);
                    setSlotStart(slot.startTime.slice(0, 5));
                    setSlotEnd(slot.endTime.slice(0, 5));
                  }}
                >
                  Edit
                </button>
              </div>
            ))}
            <p>
              Initial pattern suggestions:{' '}
              {initialPattern.map((row) => (
                <button
                  key={row.position}
                  type="button"
                  onClick={() => {
                    setSlotDraft(suggestedSlot(row));
                    setSlotStart('');
                    setSlotEnd('');
                  }}
                >
                  Test {row.position}: {days[row.startDay]}–{days[row.endDay]}
                </button>
              ))}
            </p>
            <form
              className="dashboard-form"
              key={`${schedule.id}-${slotDraft.position}-${slotDraft.title}`}
              onSubmit={saveSlot}
            >
              <div className="dashboard-form-grid">
                <label>
                  Position{' '}
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={slotDraft.position}
                    onChange={(e) =>
                      setSlotDraft({
                        ...slotDraft,
                        position: Number(e.target.value),
                      })
                    }
                    required
                  />
                </label>
                <label>
                  Cycle week (1–{schedule.cycleWeeks}){' '}
                  <input
                    type="number"
                    min={1}
                    max={schedule.cycleWeeks}
                    value={slotDraft.weekOffset + 1}
                    onChange={(e) =>
                      setSlotDraft({
                        ...slotDraft,
                        weekOffset: Number(e.target.value) - 1,
                      })
                    }
                    required
                  />
                </label>
                <label>
                  Starts on{' '}
                  <select
                    value={slotDraft.startDay}
                    onChange={(e) =>
                      setSlotDraft({
                        ...slotDraft,
                        startDay: Number(e.target.value),
                      })
                    }
                  >
                    {days.map((day, index) => (
                      <option key={day} value={index}>
                        {day}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Ends on{' '}
                  <select
                    value={slotDraft.endDay}
                    onChange={(e) =>
                      setSlotDraft({
                        ...slotDraft,
                        endDay: Number(e.target.value),
                      })
                    }
                  >
                    {days.map((day, index) => (
                      <option key={day} value={index}>
                        {day}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Start time in {schedule.timezone}{' '}
                  <input
                    type="time"
                    required
                    value={slotStart}
                    onChange={(e) => setSlotStart(e.target.value)}
                  />
                </label>
                <label>
                  End time in {schedule.timezone}{' '}
                  <input
                    type="time"
                    required
                    value={slotEnd}
                    onChange={(e) => setSlotEnd(e.target.value)}
                  />
                </label>
              </div>
              <label>
                Title{' '}
                <input
                  name="title"
                  required
                  maxLength={160}
                  defaultValue={slotDraft.title}
                />
              </label>
              <label>
                Description{' '}
                <textarea
                  name="description"
                  maxLength={5000}
                  defaultValue={slotDraft.description}
                />
              </label>
              <label className="dashboard-checkbox">
                <input
                  name="requiresVerification"
                  type="checkbox"
                  defaultChecked={slotDraft.requiresVerification}
                />
                Requires verification
              </label>
              <label className="dashboard-checkbox">
                <input
                  name="active"
                  type="checkbox"
                  defaultChecked={slotDraft.active}
                />
                Active slot
              </label>
              <button disabled={busy} type="submit">
                Save test window
              </button>
            </form>
            <button
              disabled={
                busy ||
                schedule.paused ||
                !schedule.slots.some((row) => row.active)
              }
              type="button"
              onClick={() =>
                void run(async () => {
                  const result = await post(
                    `/api/calendar/schedules/${schedule.id}/run`,
                    {},
                  );
                  return `Runner completed: ${result.published} published, ${result.blocked} blocked by blackout, ${result.existing} already recorded.`;
                })
              }
            >
              Generate due instances for next 14 days
            </button>
            <p>
              Generation runs only when this button is used or an authorized
              host scheduler invokes the runner.
            </p>
            <h3>Instance history</h3>
            <p>{instanceTotal} recorded occurrences</p>
            {instances.map((row) => (
              <div className="dashboard-list-row" key={row.id}>
                <span>
                  {row.title} · {new Date(row.startsAt).toLocaleString()} to{' '}
                  {new Date(row.endsAt).toLocaleString()} · {row.status}
                  {row.activityId && <> · Activity {row.activityId}</>}
                  {row.decidedAt && (
                    <>
                      {' '}
                      · Decision at {new Date(row.decidedAt).toLocaleString()}
                    </>
                  )}
                </span>
              </div>
            ))}
            <div>
              <button
                type="button"
                disabled={instanceOffset === 0}
                onClick={() =>
                  void loadInstances(
                    schedule.id,
                    Math.max(0, instanceOffset - 50),
                  ).catch((caught) => setError(errorText(caught)))
                }
              >
                Previous
              </button>{' '}
              <button
                type="button"
                disabled={instanceOffset + 50 >= instanceTotal}
                onClick={() =>
                  void loadInstances(schedule.id, instanceOffset + 50).catch(
                    (caught) => setError(errorText(caught)),
                  )
                }
              >
                Next
              </button>
            </div>
          </>
        )}
      </section>
      <section className="dashboard-panel dashboard-stack">
        <h2>Blackout periods</h2>
        <form className="dashboard-form" onSubmit={createBlackout}>
          <label>
            Reason <input name="reason" required maxLength={500} />
          </label>
          <div className="dashboard-form-grid">
            <label>
              Starts (browser local time){' '}
              <input name="startsAt" type="datetime-local" required />
            </label>
            <label>
              Ends (browser local time){' '}
              <input name="endsAt" type="datetime-local" required />
            </label>
          </div>
          <button disabled={busy} type="submit">
            Add blackout
          </button>
        </form>
        {overview.blackouts.map((row) => (
          <div className="dashboard-list-row" key={row.id}>
            <span>
              {row.reason} · {new Date(row.startsAt).toLocaleString()} to{' '}
              {new Date(row.endsAt).toLocaleString()} ·{' '}
              {row.active ? 'Active' : 'Inactive'}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await post(`/api/calendar/blackouts/${row.id}/active`, {
                    active: !row.active,
                  });
                  return row.active
                    ? 'Blackout deactivated. Blocked instances still require a decision.'
                    : 'Blackout activated. Review published conflicts.';
                })
              }
            >
              {row.active ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        ))}
      </section>
      <section className="dashboard-panel dashboard-stack">
        <h2>Conflicts requiring decision</h2>
        {overview.conflictsLimited && (
          <p>
            Showing the first 100 conflicts. Review database records before
            proceeding.
          </p>
        )}
        {overview.conflicts.map((row) => (
          <div className="dashboard-list-row" key={row.id}>
            <span>
              {row.title} · {new Date(row.startsAt).toLocaleString()} ·{' '}
              {row.status}
              {row.publishedOverlap && (
                <>
                  {' '}
                  · Published Activity overlaps a current blackout. Activity ID:{' '}
                  {row.activityId}. Review with its authorized creator.
                </>
              )}
            </span>
            {row.status === 'blocked' && (
              <span>
                <button
                  disabled={busy}
                  type="button"
                  onClick={() =>
                    void run(async () => {
                      await post(`/api/calendar/conflicts/${row.id}/decision`, {
                        decision: 'skip',
                      });
                      return 'Instance marked skipped; no Activity or reminder generated.';
                    })
                  }
                >
                  Keep skipped
                </button>{' '}
                <button
                  disabled={busy}
                  type="button"
                  onClick={() =>
                    void run(async () => {
                      await post(`/api/calendar/conflicts/${row.id}/decision`, {
                        decision: 'requeue',
                      });
                      return 'Instance requeued. Run generation after the blackout is inactive.';
                    })
                  }
                >
                  Requeue after blackout
                </button>
              </span>
            )}
          </div>
        ))}
        {!overview.conflicts.length && <p>No recorded conflicts.</p>}
      </section>
    </div>
  );
}
