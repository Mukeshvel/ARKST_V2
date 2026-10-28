'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  Activity,
  CreatorAssignment,
  CreatorMonitor,
} from '../../../dashboard-data';
import { dashboardJson, formatWhen } from '../../../dashboard-data';
import { CompletionProgress } from '../../../completion-progress';
import { PendingCopyButton } from '../../../pending-copy-button';
import { FollowUpPanel } from '../../../follow-up-panel';

type ResultFilter =
  'all' | 'pending' | 'overdue' | 'reported' | 'awaiting' | 'verified';

function rowState(
  row: CreatorAssignment,
  activity: Activity,
): Exclude<ResultFilter, 'all'> {
  if (row.state === 'verified') return 'verified';
  if (row.state === 'reported')
    return activity.requires_verification ? 'awaiting' : 'reported';
  return Date.now() >= Date.parse(activity.deadline_at) ? 'overdue' : 'pending';
}

export function CreatorResults({ activityId }: { activityId: string }) {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [monitor, setMonitor] = useState<CreatorMonitor | null>(null);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState<ResultFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(
    async (nextOffset: number) => {
      setLoading(true);
      setError('');
      setActivity(null);
      setMonitor(null);
      try {
        const [summary, results] = await Promise.all([
          dashboardJson<{ activity: Activity }>(
            `/api/activities/${activityId}/summary`,
          ),
          dashboardJson<CreatorMonitor>(
            `/api/activities/${activityId}/monitor?offset=${nextOffset}`,
          ),
        ]);
        if (
          !summary.activity ||
          !Array.isArray(results.assignments) ||
          typeof results.totalAssigned !== 'number'
        )
          throw new Error('Activity results are unavailable.');
        setActivity(summary.activity);
        setMonitor(results);
        setOffset(nextOffset);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Activity results are unavailable.',
        );
      } finally {
        setLoading(false);
      }
    },
    [activityId],
  );

  useEffect(() => {
    void load(0);
  }, [load]);

  const rows =
    activity && monitor
      ? monitor.assignments.filter(
          (row) => filter === 'all' || rowState(row, activity) === filter,
        )
      : [];
  const filters: { key: ResultFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'reported', label: 'Self-reported complete' },
    { key: 'awaiting', label: 'Awaiting verification' },
    { key: 'verified', label: 'Verified' },
  ];

  return (
    <section aria-label="Created activity results">
      {error && (
        <p role="alert" className="dashboard-alert">
          {error}
        </p>
      )}
      {loading && <p role="status">Loading current results…</p>}
      {activity && monitor && (
        <>
          <div className="dashboard-intro">
            <p className="dashboard-eyebrow">
              {activity.category_key.replaceAll('_', ' ')} · Creator results
            </p>
            <h1>{activity.title}</h1>
            {activity.description && <p>{activity.description}</p>}
            <p className="dashboard-muted">
              Opens {formatWhen(activity.starts_at)} · Deadline{' '}
              {formatWhen(activity.deadline_at)} · Window ends{' '}
              {formatWhen(activity.ends_at)}
            </p>
            <p className="dashboard-muted">
              {activity.requires_verification
                ? 'Student reports require separate authorized verification.'
                : 'Student reports count as complete without verification.'}{' '}
              Review pending students and record follow-ups below.
            </p>
          </div>
          <div className="dashboard-metrics" aria-label="Completion totals">
            <div>
              <strong>{monitor.totalAssigned}</strong>
              <span>Assigned</span>
            </div>
            <div>
              <strong>{monitor.pending}</strong>
              <span>Pending</span>
            </div>
            <div>
              <strong>{monitor.overdue}</strong>
              <span>Overdue</span>
            </div>
            <div>
              <strong>{monitor.selfReportedCompleted}</strong>
              <span>Self-reported complete</span>
            </div>
            <div>
              <strong>{monitor.awaitingVerification}</strong>
              <span>Awaiting verification</span>
            </div>
            <div>
              <strong>{monitor.verified}</strong>
              <span>Verified</span>
            </div>
          </div>
          <CompletionProgress
            total={monitor.totalAssigned}
            reported={monitor.selfReportedCompleted}
            awaiting={monitor.awaitingVerification}
            verified={monitor.verified}
          />
          <PendingCopyButton activityId={activityId} view="creator" />
          <div className="dashboard-toolbar">
            <p className="dashboard-muted">
              Filtering the {monitor.assignments.length} assignments on this
              page.
            </p>
            <button
              type="button"
              className="dashboard-secondary"
              disabled={loading}
              onClick={() => void load(offset)}
            >
              Refresh results
            </button>
          </div>
          <div
            className="dashboard-filter"
            role="group"
            aria-label="Filter assigned students"
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
          {rows.length ? (
            <div className="dashboard-stack">
              {rows.map((row) => {
                const state = rowState(row, activity);
                return (
                  <article
                    className="dashboard-list-row"
                    key={row.assignmentId}
                  >
                    <div>
                      <h3>
                        {row.studentName ??
                          row.studentIdentifier ??
                          'Roster name unavailable'}
                      </h3>
                      {row.studentIdentifier && (
                        <p className="dashboard-muted">
                          Student ID {row.studentIdentifier}
                        </p>
                      )}
                      {row.submittedAt && (
                        <p className="dashboard-muted">
                          Reported {formatWhen(row.submittedAt)}
                          {row.verifiedAt &&
                            ` · Verified ${formatWhen(row.verifiedAt)}`}
                        </p>
                      )}
                    </div>
                    <span
                      className={`dashboard-state dashboard-state-${state}`}
                    >
                      {filters.find((item) => item.key === state)?.label}
                    </span>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="dashboard-empty">
              No assignments on this page match that filter.
            </p>
          )}
          <FollowUpPanel
            targets={monitor.assignments.map((row) => ({
              assignmentId: row.assignmentId,
              studentName: row.studentName ?? 'Roster name unavailable',
              studentIdentifier:
                row.studentIdentifier ?? 'Identifier unavailable',
              deadlineAt: activity.deadline_at,
              pending: row.state === null,
            }))}
          />
          <div className="dashboard-actions dashboard-pagination">
            <button
              className="dashboard-secondary"
              disabled={loading || offset === 0}
              onClick={() => void load(Math.max(0, offset - 50))}
            >
              Previous page
            </button>
            <span>
              Page {Math.floor(offset / 50) + 1} · {monitor.totalAssigned}{' '}
              assigned
            </span>
            <button
              className="dashboard-secondary"
              disabled={loading || offset + 50 >= monitor.totalAssigned}
              onClick={() => void load(offset + 50)}
            >
              Next page
            </button>
          </div>
        </>
      )}
    </section>
  );
}
