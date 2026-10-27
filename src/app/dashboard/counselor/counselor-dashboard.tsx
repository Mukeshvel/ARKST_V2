'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CounselorAssignment } from '../dashboard-data';
import { dashboardJson, formatWhen } from '../dashboard-data';

type Mapping = {
  id: string;
  student: {
    id: string;
    external_student_id: string;
    display_name: string;
    section_scope_id: string;
    active: boolean;
  };
};

function counselingState(row: CounselorAssignment) {
  if (row.state === 'verified') return 'verified';
  if (row.state === 'reported')
    return row.requiresVerification ? 'awaiting' : 'reported';
  return Date.now() >= Date.parse(row.deadlineAt) ? 'overdue' : 'pending';
}

const labels = {
  pending: 'Pending',
  overdue: 'Overdue',
  reported: 'Self-reported complete',
  awaiting: 'Awaiting verification',
  verified: 'Verified',
};

export function CounselorDashboard() {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [mappingTotal, setMappingTotal] = useState(0);
  const [mappingOffset, setMappingOffset] = useState(0);
  const [mappingLoading, setMappingLoading] = useState(true);
  const [mappingError, setMappingError] = useState('');
  const [activities, setActivities] = useState<CounselorAssignment[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityOffset, setActivityOffset] = useState(0);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState('');
  const [filter, setFilter] = useState<'all' | keyof typeof labels>('all');

  const loadMappings = useCallback(async (offset: number) => {
    setMappingLoading(true);
    setMappingError('');
    try {
      const body = await dashboardJson<{ students: Mapping[]; total: number }>(
        `/api/counselor/students?offset=${offset}`,
      );
      if (!Array.isArray(body.students) || typeof body.total !== 'number')
        throw new Error('Mapped students are unavailable.');
      setMappings(body.students);
      setMappingTotal(body.total);
      setMappingOffset(offset);
    } catch (error) {
      setMappings([]);
      setMappingTotal(0);
      setMappingError(
        error instanceof Error
          ? error.message
          : 'Mapped students are unavailable.',
      );
    } finally {
      setMappingLoading(false);
    }
  }, []);

  const loadActivities = useCallback(async (offset: number) => {
    setActivityLoading(true);
    setActivityError('');
    try {
      const body = await dashboardJson<{
        assignments: CounselorAssignment[];
        total: number;
      }>(`/api/counselor/activities?offset=${offset}`);
      if (!Array.isArray(body.assignments) || typeof body.total !== 'number')
        throw new Error('Counseling Activity status is unavailable.');
      setActivities(body.assignments);
      setActivityTotal(body.total);
      setActivityOffset(offset);
    } catch (error) {
      setActivities([]);
      setActivityTotal(0);
      setActivityError(
        error instanceof Error
          ? error.message
          : 'Counseling Activity status is unavailable.',
      );
    } finally {
      setActivityLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMappings(0);
    void loadActivities(0);
  }, [loadMappings, loadActivities]);

  const visible = activities.filter(
    (row) => filter === 'all' || counselingState(row) === filter,
  );

  return (
    <div className="dashboard-columns">
      <section className="dashboard-panel" aria-labelledby="mapped-heading">
        <div className="dashboard-section-head">
          <div>
            <p className="dashboard-eyebrow">Trusted directory</p>
            <h2 id="mapped-heading">Current mapped students</h2>
          </div>
          <button
            type="button"
            className="dashboard-secondary"
            disabled={mappingLoading}
            onClick={() => void loadMappings(mappingOffset)}
          >
            Refresh
          </button>
        </div>
        {mappingError && (
          <p role="alert" className="dashboard-alert">
            {mappingError}
          </p>
        )}
        {mappingLoading ? (
          <p role="status">Loading current mappings…</p>
        ) : mappingError ? null : mappings.length ? (
          <ul className="dashboard-roster">
            {mappings.map((mapping) => (
              <li key={mapping.id}>
                <strong>{mapping.student.display_name}</strong>
                <span>{mapping.student.external_student_id}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="dashboard-empty">
            No active students are mapped to your current counselor
            responsibility. Mappings are set by the approved administrator, not
            by profile edits.
          </p>
        )}
        {!mappingError && (
          <div className="dashboard-actions dashboard-pagination">
            <button
              className="dashboard-secondary"
              disabled={mappingLoading || mappingOffset === 0}
              onClick={() => void loadMappings(Math.max(0, mappingOffset - 50))}
            >
              Previous
            </button>
            <span>
              {mappingTotal} mapped · Page {Math.floor(mappingOffset / 50) + 1}
            </span>
            <button
              className="dashboard-secondary"
              disabled={mappingLoading || mappingOffset + 50 >= mappingTotal}
              onClick={() => void loadMappings(mappingOffset + 50)}
            >
              Next
            </button>
          </div>
        )}
      </section>
      <section
        className="dashboard-panel"
        aria-labelledby="counseling-work-heading"
      >
        <div className="dashboard-section-head">
          <div>
            <p className="dashboard-eyebrow">Shared Activity records</p>
            <h2 id="counseling-work-heading">Assigned work</h2>
          </div>
          <button
            type="button"
            className="dashboard-secondary"
            disabled={activityLoading}
            onClick={() => void loadActivities(activityOffset)}
          >
            Refresh status
          </button>
        </div>
        <p className="dashboard-muted">
          Only current mapped students are shown. Results are read only here;
          counseling access does not grant verification authority.
        </p>
        {activityError && (
          <p role="alert" className="dashboard-alert">
            {activityError}
          </p>
        )}
        <div
          className="dashboard-filter"
          role="group"
          aria-label="Filter shown counseling activities"
        >
          <button
            type="button"
            aria-pressed={filter === 'all'}
            className={
              filter === 'all'
                ? 'dashboard-filter-active'
                : 'dashboard-secondary'
            }
            onClick={() => setFilter('all')}
          >
            All
          </button>
          {Object.entries(labels).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              className={
                filter === key
                  ? 'dashboard-filter-active'
                  : 'dashboard-secondary'
              }
              onClick={() => setFilter(key as keyof typeof labels)}
            >
              {label}
            </button>
          ))}
        </div>
        {activityLoading ? (
          <p role="status">Loading assigned work…</p>
        ) : activityError ? null : visible.length ? (
          <div className="dashboard-stack">
            {visible.map((row) => {
              const state = counselingState(row);
              return (
                <article className="dashboard-list-row" key={row.assignmentId}>
                  <div>
                    <p className="dashboard-eyebrow">
                      {row.category.replaceAll('_', ' ')}
                    </p>
                    <h3>{row.title}</h3>
                    <p>
                      {row.studentName} · {row.studentIdentifier}
                    </p>
                    <p className="dashboard-muted">
                      Deadline {formatWhen(row.deadlineAt)}
                      {row.submittedAt &&
                        ` · Reported ${formatWhen(row.submittedAt)}`}
                    </p>
                  </div>
                  <span className={`dashboard-state dashboard-state-${state}`}>
                    {labels[state]}
                  </span>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="dashboard-empty">
            {activities.length
              ? 'No assignments on this page match that filter.'
              : 'No Activity assignments currently exist for your mapped students.'}
          </p>
        )}
        {!activityError && (
          <div className="dashboard-actions dashboard-pagination">
            <button
              className="dashboard-secondary"
              disabled={activityLoading || activityOffset === 0}
              onClick={() =>
                void loadActivities(Math.max(0, activityOffset - 50))
              }
            >
              Previous
            </button>
            <span>
              {activityTotal} assignments · Page{' '}
              {Math.floor(activityOffset / 50) + 1}
            </span>
            <button
              className="dashboard-secondary"
              disabled={activityLoading || activityOffset + 50 >= activityTotal}
              onClick={() => void loadActivities(activityOffset + 50)}
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
