'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import type { Activity, CreationOption } from '../dashboard-data';
import { dashboardJson, formatWhen } from '../dashboard-data';
import { CandidatePicker, type Candidate } from './candidate-picker';

type Created = {
  id: string;
  assignedCount: number;
  rosterRows: number;
  unlinkedRows: number;
  inactiveRows: number;
  missingMembershipRows: number;
};

export function FacultyDashboard() {
  const [options, setOptions] = useState<CreationOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [category, setCategory] = useState('');
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [targetMode, setTargetMode] = useState<
    'sections' | 'selected' | 'counseling'
  >('sections');
  const [selectedStudents, setSelectedStudents] = useState<Candidate[]>([]);
  const selection = useRef({ departmentId: '', category: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [created, setCreated] = useState<Created | null>(null);
  const saveInFlight = useRef(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [listOffset, setListOffset] = useState(0);
  const [listTotal, setListTotal] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');

  const loadOptions = useCallback(async () => {
    setOptionsLoading(true);
    setOptionsError('');
    try {
      const body = await dashboardJson<{ options: CreationOption[] }>(
        '/api/activities/options',
      );
      if (!Array.isArray(body.options))
        throw new Error('Creation options are unavailable.');
      setOptions(body.options);
      const nextDepartment = body.options.some(
        (row) => row.department_id === selection.current.departmentId,
      )
        ? selection.current.departmentId
        : (body.options[0]?.department_id ?? '');
      const nextCategory = body.options.some(
        (row) =>
          row.department_id === nextDepartment &&
          row.category_key === selection.current.category,
      )
        ? selection.current.category
        : (body.options.find((row) => row.department_id === nextDepartment)
            ?.category_key ?? '');
      selection.current = {
        departmentId: nextDepartment,
        category: nextCategory,
      };
      setDepartmentId(nextDepartment);
      setCategory(nextCategory);
      setSelectedSections((current) =>
        current.filter((id) =>
          body.options.some(
            (row) =>
              row.department_id === nextDepartment &&
              row.category_key === nextCategory &&
              row.section_id === id,
          ),
        ),
      );
    } catch (error) {
      setOptionsError(
        `Current creation options could not be loaded. ${error instanceof Error ? error.message : 'Please retry.'}`,
      );
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  const loadCreated = useCallback(async (offset: number) => {
    setListLoading(true);
    setListError('');
    try {
      const body = await dashboardJson<{
        activities: Activity[];
        total: number;
      }>(`/api/activities/created?offset=${offset}`);
      if (!Array.isArray(body.activities) || typeof body.total !== 'number')
        throw new Error('Created activities are unavailable.');
      setActivities(body.activities);
      setListOffset(offset);
      setListTotal(body.total);
    } catch (error) {
      setActivities([]);
      setListTotal(0);
      setListError(
        error instanceof Error
          ? error.message
          : 'Created activities are unavailable.',
      );
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOptions();
    void loadCreated(0);
  }, [loadOptions, loadCreated]);

  const departments = [
    ...new Map(
      options.map((row) => [row.department_id, row.department_name]),
    ).entries(),
  ];
  const categories = [
    ...new Map(
      options
        .filter((row) => row.department_id === departmentId)
        .map((row) => [row.category_key, row.category_label]),
    ).entries(),
  ];
  const sections = [
    ...new Map(
      options
        .filter(
          (row) =>
            row.department_id === departmentId && row.category_key === category,
        )
        .map((row) => [
          row.section_id,
          {
            id: row.section_id,
            name: row.section_name,
            eligible: row.eligible_count,
          },
        ]),
    ).values(),
  ];
  const eligibleNow = sections
    .filter((row) => selectedSections.includes(row.id))
    .reduce((sum, row) => sum + row.eligible, 0);

  function changeDepartment(id: string) {
    const nextCategory =
      options.find((row) => row.department_id === id)?.category_key ?? '';
    selection.current = { departmentId: id, category: nextCategory };
    setDepartmentId(id);
    setCategory(nextCategory);
    setSelectedSections([]);
    setSelectedStudents([]);
    setCreated(null);
  }

  function changeCategory(key: string) {
    selection.current = { departmentId, category: key };
    setCategory(key);
    setSelectedSections([]);
    setSelectedStudents([]);
    setCreated(null);
  }

  function toggleSection(id: string) {
    setSelectedSections((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
    setCreated(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    setSaving(true);
    setSaveError('');
    setCreated(null);
    const form = new FormData(event.currentTarget);
    try {
      if (
        !departmentId ||
        !category ||
        (targetMode === 'sections'
          ? selectedSections.length === 0
          : selectedStudents.length === 0)
      )
        throw new Error(
          'Select an authorized category and at least one recipient.',
        );
      const startsAt = new Date(
        String(form.get('startsAt') ?? ''),
      ).toISOString();
      const deadlineAt = new Date(
        String(form.get('deadlineAt') ?? ''),
      ).toISOString();
      const endsAt = new Date(String(form.get('endsAt') ?? '')).toISOString();
      if (!(startsAt < deadlineAt && deadlineAt <= endsAt))
        throw new Error(
          'Start must precede the deadline, and the end must follow it.',
        );
      const sectionMode = targetMode === 'sections';
      const body = await dashboardJson<Created>(
        sectionMode ? '/api/activities/sections' : '/api/activities/selected',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            departmentScopeId: departmentId,
            ...(sectionMode
              ? { sectionIds: selectedSections }
              : {
                  studentIds: selectedStudents.map(
                    (student) => student.studentId,
                  ),
                  counselingOnly: targetMode === 'counseling',
                }),
            category,
            title: String(form.get('title') ?? ''),
            description: String(form.get('description') ?? ''),
            startsAt,
            deadlineAt,
            endsAt,
            requiresVerification: form.get('requiresVerification') === 'on',
          }),
        },
      );
      if (!body.id || typeof body.assignedCount !== 'number')
        throw new Error(
          'The save response is incomplete. Reload before retrying.',
        );
      setCreated(body);
      await loadCreated(0);
      await loadOptions();
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : 'Save failed. Reload before retrying.',
      );
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="dashboard-columns">
      <section className="dashboard-panel" aria-labelledby="create-heading">
        <div className="dashboard-section-head">
          <div>
            <p className="dashboard-eyebrow">Publish</p>
            <h2 id="create-heading">Create one activity</h2>
          </div>
          <button
            type="button"
            className="dashboard-secondary"
            disabled={optionsLoading}
            onClick={() => void loadOptions()}
          >
            Refresh options
          </button>
        </div>
        <p className="dashboard-muted">
          Sections and categories below come from your current database
          approvals. Student assignments are checked again when you save.
        </p>
        {optionsError && (
          <p role="alert" className="dashboard-alert">
            {optionsError}
          </p>
        )}
        {optionsLoading && options.length === 0 ? (
          <p role="status">Loading authorized options…</p>
        ) : optionsError && options.length === 0 ? null : options.length ===
          0 ? (
          <p className="dashboard-empty">
            No Activity CREATE approval or department sections are available to
            your account. Your profile preferences do not grant access.
          </p>
        ) : (
          <form
            className="dashboard-form"
            onSubmit={(event) => void save(event)}
          >
            <label>
              Department
              <select
                value={departmentId}
                onChange={(event) => changeDepartment(event.target.value)}
                required
              >
                {departments.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Category
              <select
                value={category}
                onChange={(event) => changeCategory(event.target.value)}
                required
              >
                {categories.map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Assign to
              <select
                value={targetMode}
                onChange={(event) => {
                  setTargetMode(event.target.value as typeof targetMode);
                  setSelectedSections([]);
                  setSelectedStudents([]);
                  setCreated(null);
                }}
              >
                <option value="sections">
                  All eligible students in section(s)
                </option>
                <option value="selected">Selected eligible students</option>
                <option value="counseling">
                  My current counseling students
                </option>
              </select>
            </label>
            {targetMode === 'sections' ? (
              <fieldset>
                <legend>Assign to sections</legend>
                {sections.map((section) => (
                  <label className="dashboard-checkbox" key={section.id}>
                    <input
                      type="checkbox"
                      checked={selectedSections.includes(section.id)}
                      onChange={() => toggleSection(section.id)}
                    />
                    <span>
                      {section.name}{' '}
                      <small>· {section.eligible} eligible now</small>
                    </span>
                  </label>
                ))}
              </fieldset>
            ) : (
              <CandidatePicker
                departmentId={departmentId}
                category={category}
                counselingOnly={targetMode === 'counseling'}
                selected={selectedStudents}
                onChange={setSelectedStudents}
              />
            )}
            {targetMode === 'sections' && (
              <p className="dashboard-muted">
                {eligibleNow} eligible student{eligibleNow === 1 ? '' : 's'} in
                selected sections now. The saved count may change if the roster
                changes before publication.
              </p>
            )}
            {targetMode === 'sections' &&
              eligibleNow === 0 &&
              selectedSections.length > 0 && (
                <p className="dashboard-alert" role="status">
                  No eligible students are currently provisioned in the selected
                  sections. Publication requires at least one.
                </p>
              )}
            <label>
              Title <input name="title" required maxLength={160} />
            </label>
            <label>
              Description{' '}
              <textarea
                name="description"
                rows={4}
                maxLength={5000}
                defaultValue=""
              />
            </label>
            <div className="dashboard-form-grid">
              <label>
                Start <input name="startsAt" type="datetime-local" required />
              </label>
              <label>
                Deadline{' '}
                <input name="deadlineAt" type="datetime-local" required />
              </label>
              <label>
                Window end{' '}
                <input name="endsAt" type="datetime-local" required />
              </label>
            </div>
            <label className="dashboard-checkbox">
              <input name="requiresVerification" type="checkbox" />
              <span>
                Require authorized staff verification after a student reports
                completion
              </span>
            </label>
            <button
              disabled={
                saving ||
                optionsLoading ||
                Boolean(optionsError) ||
                (targetMode === 'sections'
                  ? eligibleNow === 0 || selectedSections.length === 0
                  : selectedStudents.length === 0)
              }
              type="submit"
            >
              {saving
                ? 'Saving activity…'
                : targetMode === 'sections'
                  ? 'Publish to selected sections'
                  : 'Publish activity'}
            </button>
            {saveError && (
              <p role="alert" className="dashboard-alert">
                {saveError}
              </p>
            )}
            {created && (
              <div role="status" className="dashboard-notice">
                <p>
                  Saved one activity with {created.assignedCount} assigned
                  student{created.assignedCount === 1 ? '' : 's'}.
                </p>
                {targetMode === 'sections' && (
                  <p>
                    {created.unlinkedRows} unlinked, {created.inactiveRows}{' '}
                    inactive and {created.missingMembershipRows}{' '}
                    missing-membership roster row
                    {created.missingMembershipRows === 1 ? '' : 's'} were
                    excluded.
                  </p>
                )}
                <Link href={`/dashboard/faculty/activities/${created.id}`}>
                  Open completion results
                </Link>
              </div>
            )}
          </form>
        )}
      </section>
      <section className="dashboard-panel" aria-labelledby="created-heading">
        <div className="dashboard-section-head">
          <div>
            <p className="dashboard-eyebrow">Monitor</p>
            <h2 id="created-heading">My published activities</h2>
          </div>
          <button
            type="button"
            className="dashboard-secondary"
            disabled={listLoading}
            onClick={() => void loadCreated(listOffset)}
          >
            Refresh
          </button>
        </div>
        {listError && (
          <p role="alert" className="dashboard-alert">
            {listError}
          </p>
        )}
        {listLoading ? (
          <p role="status">Loading saved activities…</p>
        ) : listError ? null : activities.length ? (
          <div className="dashboard-stack">
            {activities.map((activity) => (
              <article className="dashboard-list-row" key={activity.id}>
                <div>
                  <p className="dashboard-eyebrow">
                    {activity.category_key.replaceAll('_', ' ')}
                  </p>
                  <h3>{activity.title}</h3>
                  <p className="dashboard-muted">
                    Deadline {formatWhen(activity.deadline_at)}
                  </p>
                </div>
                <Link href={`/dashboard/faculty/activities/${activity.id}`}>
                  View results
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <p className="dashboard-empty">
            No published activities are currently visible to your account.
          </p>
        )}
        {!listError && (
          <div className="dashboard-actions dashboard-pagination">
            <button
              className="dashboard-secondary"
              disabled={listLoading || listOffset === 0}
              onClick={() => void loadCreated(Math.max(0, listOffset - 50))}
            >
              Previous
            </button>
            <span>
              {listTotal} visible · Page {Math.floor(listOffset / 50) + 1}
            </span>
            <button
              className="dashboard-secondary"
              disabled={listLoading || listOffset + 50 >= listTotal}
              onClick={() => void loadCreated(listOffset + 50)}
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
