'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import type { CreationOption } from '../dashboard-data';
import { dashboardJson } from '../dashboard-data';
import { CandidatePicker, type Candidate } from './candidate-picker';

export function AnnouncementComposer() {
  const [options, setOptions] = useState<CreationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [optionsError, setOptionsError] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [mode, setMode] = useState<'sections' | 'selected' | 'counseling'>(
    'sections',
  );
  const [sections, setSections] = useState<string[]>([]);
  const [students, setStudents] = useState<Candidate[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [published, setPublished] = useState<{
    id: string;
    recipientCount: number;
  } | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setOptionsError('');
    try {
      const body = await dashboardJson<{ options: CreationOption[] }>(
        '/api/activities/options',
      );
      if (!Array.isArray(body.options))
        throw new Error('Announcement sections are unavailable.');
      const general = body.options.filter(
        (row) => row.category_key === 'general',
      );
      setOptions(general);
      setDepartmentId((current) =>
        general.some((row) => row.department_id === current)
          ? current
          : (general[0]?.department_id ?? ''),
      );
      setSections((current) =>
        current.filter((id) => general.some((row) => row.section_id === id)),
      );
    } catch (cause) {
      setOptionsError(
        cause instanceof Error
          ? cause.message
          : 'Announcement sections are unavailable.',
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const departments = [
    ...new Map(
      options.map((row) => [row.department_id, row.department_name]),
    ).entries(),
  ];
  const availableSections = options.filter(
    (row) => row.department_id === departmentId,
  );
  const eligible = availableSections
    .filter((row) => sections.includes(row.section_id))
    .reduce((sum, row) => sum + row.eligible_count, 0);

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setSaveError('');
    setPublished(null);
    const form = new FormData(event.currentTarget);
    try {
      const body = await dashboardJson<{ id: string; recipientCount: number }>(
        '/api/announcements',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            departmentScopeId: departmentId,
            mode,
            ...(mode === 'sections'
              ? { sectionIds: sections }
              : { studentIds: students.map((student) => student.studentId) }),
            title: String(form.get('title') ?? ''),
            message: String(form.get('message') ?? ''),
          }),
        },
      );
      if (!body.id || typeof body.recipientCount !== 'number')
        throw new Error(
          'Publication result is incomplete. Reload before retrying.',
        );
      setPublished(body);
    } catch (cause) {
      setSaveError(
        cause instanceof Error ? cause.message : 'Announcement failed.',
      );
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <section className="dashboard-panel" aria-labelledby="announcement-heading">
      <div className="dashboard-section-head">
        <div>
          <p className="dashboard-eyebrow">Information</p>
          <h2 id="announcement-heading">Publish an announcement</h2>
        </div>
        <button
          type="button"
          className="dashboard-secondary"
          disabled={loading}
          onClick={() => void load()}
        >
          Refresh permissions
        </button>
      </div>
      <p className="dashboard-muted">
        Announcements inform students. They do not create a completion task or
        cancel a scheduled Activity.
      </p>
      {optionsError && (
        <p role="alert" className="dashboard-alert">
          {optionsError}
        </p>
      )}
      {loading && options.length === 0 ? (
        <p role="status">Loading authorized sections…</p>
      ) : optionsError && options.length === 0 ? null : options.length === 0 ? (
        <p className="dashboard-empty">
          No general-category CREATE approval is available for announcements.
        </p>
      ) : (
        <form
          className="dashboard-form"
          onSubmit={(event) => void publish(event)}
        >
          <label>
            Department
            <select
              value={departmentId}
              onChange={(event) => {
                setDepartmentId(event.target.value);
                setSections([]);
                setStudents([]);
                setPublished(null);
              }}
            >
              {departments.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Audience
            <select
              value={mode}
              onChange={(event) => {
                setMode(event.target.value as typeof mode);
                setSections([]);
                setStudents([]);
                setPublished(null);
              }}
            >
              <option value="sections">
                All eligible students in section(s)
              </option>
              <option value="selected">Selected eligible students</option>
              <option value="counseling">My current counseling students</option>
            </select>
          </label>
          {mode === 'sections' ? (
            <fieldset>
              <legend>Sections</legend>
              {availableSections.map((row) => (
                <label className="dashboard-checkbox" key={row.section_id}>
                  <input
                    type="checkbox"
                    checked={sections.includes(row.section_id)}
                    onChange={() =>
                      setSections((current) =>
                        current.includes(row.section_id)
                          ? current.filter((id) => id !== row.section_id)
                          : [...current, row.section_id],
                      )
                    }
                  />
                  <span>
                    {row.section_name} · {row.eligible_count} eligible
                  </span>
                </label>
              ))}
            </fieldset>
          ) : (
            <CandidatePicker
              departmentId={departmentId}
              category="general"
              counselingOnly={mode === 'counseling'}
              selected={students}
              onChange={setStudents}
            />
          )}
          <label>
            Title
            <input name="title" maxLength={160} required />
          </label>
          <label>
            Message
            <textarea name="message" rows={4} maxLength={5000} required />
          </label>
          <button
            type="submit"
            disabled={
              saving ||
              loading ||
              Boolean(optionsError) ||
              (mode === 'sections' ? eligible === 0 : students.length === 0)
            }
          >
            {saving ? 'Publishing…' : 'Publish announcement'}
          </button>
          {mode === 'sections' && sections.length > 0 && eligible === 0 && (
            <p role="status" className="dashboard-alert">
              No eligible provisioned students in the selected sections.
            </p>
          )}
          {saveError && (
            <p role="alert" className="dashboard-alert">
              {saveError}
            </p>
          )}
          {published && (
            <p role="status" className="dashboard-notice">
              Saved for {published.recipientCount} student
              {published.recipientCount === 1 ? '' : 's'}.{' '}
              <Link href={`/dashboard/announcements/${published.id}`}>
                View announcement
              </Link>
            </p>
          )}
        </form>
      )}
    </section>
  );
}
