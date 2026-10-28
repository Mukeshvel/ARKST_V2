'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { EscalationAction } from '../escalation-action';
import type { Activity, Assignment, HistoryEvent } from '../dashboard-data';
import {
  activityState,
  dashboardJson,
  formatWhen,
  readableState,
} from '../dashboard-data';

type StudentFilter = 'all' | ReturnType<typeof activityState>;

function StudentActivity({
  activity,
  assignment,
  onSubmit,
  busy,
}: {
  activity: Activity;
  assignment: Assignment;
  onSubmit: (activityId: string, assignmentId: string) => Promise<void>;
  busy: boolean;
}) {
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const state = activityState(activity, assignment);

  async function loadHistory(offset: number) {
    setHistoryBusy(true);
    setHistoryError('');
    try {
      const body = await dashboardJson<{ history: HistoryEvent[] }>(
        `/api/activities/${activity.id}/history?offset=${offset}`,
      );
      if (!Array.isArray(body.history))
        throw new Error('History is unavailable.');
      setHistory(
        body.history.filter((event) => event.assignment_id === assignment.id),
      );
      setHistoryOffset(offset);
      setHistoryOpen(true);
    } catch (error) {
      setHistory([]);
      setHistoryOpen(false);
      setHistoryError(
        error instanceof Error ? error.message : 'History is unavailable.',
      );
    } finally {
      setHistoryBusy(false);
    }
  }

  return (
    <article className="dashboard-card">
      <div className="dashboard-card-head">
        <div>
          <p className="dashboard-eyebrow">
            {activity.category_key.replaceAll('_', ' ')}
          </p>
          <h3>{activity.title}</h3>
        </div>
        <span className={`dashboard-state dashboard-state-${state}`}>
          {readableState(state)}
        </span>
      </div>
      {activity.description && (
        <p className="dashboard-description">{activity.description}</p>
      )}
      <dl className="dashboard-dates">
        <div>
          <dt>Opens</dt>
          <dd>{formatWhen(activity.starts_at)}</dd>
        </div>
        <div>
          <dt>Deadline</dt>
          <dd>{formatWhen(activity.deadline_at)}</dd>
        </div>
        <div>
          <dt>Window ends</dt>
          <dd>{formatWhen(activity.ends_at)}</dd>
        </div>
      </dl>
      <p className="dashboard-muted">
        {activity.requires_verification
          ? 'A report stays awaiting verification until an authorized reviewer approves it.'
          : 'Your report counts as complete without staff verification.'}
      </p>
      {assignment.completion && (
        <p className="dashboard-muted">
          Reported {formatWhen(assignment.completion.submitted_at)}
          {assignment.completion.verified_at &&
            ` · Verified ${formatWhen(assignment.completion.verified_at)}`}
        </p>
      )}
      <div className="dashboard-actions">
        {state === 'current' && (
          <button
            disabled={busy}
            onClick={() => void onSubmit(activity.id, assignment.id)}
          >
            {busy ? 'Submitting…' : 'Report completion'}
          </button>
        )}
        <button
          className="dashboard-secondary"
          disabled={historyBusy}
          aria-expanded={historyOpen}
          onClick={() =>
            historyOpen ? setHistoryOpen(false) : void loadHistory(0)
          }
        >
          {historyBusy
            ? 'Loading history…'
            : historyOpen
              ? 'Hide history'
              : 'View my history'}
        </button>
      </div>
      {!assignment.completion && (
        <details>
          <summary>Need counselor attention?</summary>
          <p className="dashboard-muted">
            Send this pending Activity to your currently assigned counselor. A
            missing mapping or duplicate request is rejected.
          </p>
          <EscalationAction
            assignmentId={assignment.id}
            label="Send to counselor"
          />
        </details>
      )}
      {historyError && <p role="alert">{historyError}</p>}
      {historyOpen && (
        <section
          aria-label={`History for ${activity.title}`}
          className="dashboard-history"
        >
          {history.length ? (
            <ol>
              {history.map((event) => (
                <li key={event.id}>
                  {event.action.replaceAll('_', ' ')} ·{' '}
                  {formatWhen(event.occurred_at)}
                </li>
              ))}
            </ol>
          ) : (
            <p>No assignment events on this page.</p>
          )}
          <div className="dashboard-actions">
            <button
              className="dashboard-secondary"
              disabled={historyOffset === 0 || historyBusy}
              onClick={() => void loadHistory(Math.max(0, historyOffset - 50))}
            >
              Previous events
            </button>
            <button
              className="dashboard-secondary"
              disabled={history.length < 50 || historyBusy}
              onClick={() => void loadHistory(historyOffset + 50)}
            >
              Next events
            </button>
          </div>
        </section>
      )}
    </article>
  );
}

export function StudentDashboard({
  studentId,
  focusedActivityId,
}: {
  studentId: string;
  focusedActivityId?: string | undefined;
}) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState<StudentFilter>('all');
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const inFlight = useRef(new Set<string>());

  const load = useCallback(
    async (nextOffset: number) => {
      setLoading(true);
      setError('');
      try {
        const body = focusedActivityId
          ? await dashboardJson<{ activity: Activity }>(
              `/api/activities/${focusedActivityId}`,
            )
          : await dashboardJson<{ activities: Activity[] }>(
              `/api/activities?offset=${nextOffset}`,
            );
        const loaded = 'activities' in body ? body.activities : [body.activity];
        if (!Array.isArray(loaded))
          throw new Error('Activities are unavailable.');
        for (const activity of loaded) {
          if (
            !Array.isArray(activity.assignments) ||
            activity.assignments.some((a) => a.student_id !== studentId)
          )
            throw new Error(
              'Assigned activity data did not match your account.',
            );
        }
        setActivities(loaded);
        setOffset(nextOffset);
      } catch (cause) {
        setActivities([]);
        setError(
          cause instanceof Error
            ? cause.message
            : 'Activities are unavailable.',
        );
      } finally {
        setLoading(false);
      }
    },
    [studentId, focusedActivityId],
  );

  useEffect(() => {
    void load(0);
  }, [load]);

  async function submit(activityId: string, assignmentId: string) {
    if (inFlight.current.has(assignmentId)) return;
    inFlight.current.add(assignmentId);
    setSubmittingId(assignmentId);
    setError('');
    setNotice('');
    try {
      await dashboardJson(`/api/activity-assignments/${assignmentId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const body = await dashboardJson<{ activity: Activity }>(
        `/api/activities/${activityId}`,
      );
      if (!body.activity || !Array.isArray(body.activity.assignments))
        throw new Error(
          'Submission was sent, but the saved status could not be reloaded. Reload to confirm.',
        );
      setActivities((current) =>
        current.map((item) => (item.id === activityId ? body.activity : item)),
      );
      setNotice('Saved status reloaded from the activity record.');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Submission failed; reload before retrying.',
      );
    } finally {
      inFlight.current.delete(assignmentId);
      setSubmittingId(null);
    }
  }

  const rows = activities.flatMap((activity) =>
    (activity.assignments ?? []).map((assignment) => ({
      activity,
      assignment,
    })),
  );
  const visible = rows.filter(
    ({ activity, assignment }) =>
      filter === 'all' || activityState(activity, assignment) === filter,
  );
  const filters: { key: StudentFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'current', label: 'Current' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'reported', label: 'Self-reported' },
    { key: 'awaiting', label: 'Awaiting verification' },
    { key: 'verified', label: 'Verified' },
  ];

  return (
    <section aria-label="Assigned activities">
      {focusedActivityId && (
        <p>
          <Link href="/dashboard/student">All my activities</Link>
        </p>
      )}
      <div className="dashboard-toolbar">
        <p className="dashboard-muted">
          {loading
            ? 'Loading your assigned work…'
            : error && activities.length === 0
              ? 'Assigned work is unavailable.'
              : `Showing ${rows.length} assignment${rows.length === 1 ? '' : 's'} on this page.`}
        </p>
        <div
          className="dashboard-filter"
          role="group"
          aria-label="Filter shown activities"
        >
          {filters.map((item) => (
            <button
              key={item.key}
              type="button"
              className={
                filter === item.key
                  ? 'dashboard-filter-active'
                  : 'dashboard-secondary'
              }
              aria-pressed={filter === item.key}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p role="alert" className="dashboard-alert">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="dashboard-notice">
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status">Loading assigned activities…</p>
      ) : error && activities.length === 0 ? null : visible.length ? (
        <div className="dashboard-stack">
          {visible.map(({ activity, assignment }) => (
            <StudentActivity
              key={assignment.id}
              activity={activity}
              assignment={assignment}
              onSubmit={submit}
              busy={submittingId === assignment.id}
            />
          ))}
        </div>
      ) : (
        <p className="dashboard-empty">
          {activities.length
            ? 'No activities on this page match that filter.'
            : 'No activities are assigned to your account on this page.'}
        </p>
      )}
      {!focusedActivityId && (!error || activities.length > 0) && (
        <div className="dashboard-actions dashboard-pagination">
          <button
            className="dashboard-secondary"
            disabled={loading || offset === 0}
            onClick={() => void load(Math.max(0, offset - 50))}
          >
            Previous page
          </button>
          <span>Page {Math.floor(offset / 50) + 1}</span>
          <button
            className="dashboard-secondary"
            disabled={loading || activities.length < 50}
            onClick={() => void load(offset + 50)}
          >
            Next page
          </button>
        </div>
      )}
    </section>
  );
}
