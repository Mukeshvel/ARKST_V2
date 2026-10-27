'use client';

import { useCallback, useEffect, useState } from 'react';
import { dashboardJson, formatWhen } from '../../../dashboard-data';
import { CompletionProgress } from '../../../completion-progress';
import { PendingCopyButton } from '../../../pending-copy-button';

type Row = {
  assignmentId: string;
  studentName: string;
  studentIdentifier: string;
  state: 'reported' | 'verified' | null;
  submittedAt: string | null;
  verifiedAt: string | null;
  deadlineAt: string;
  requiresVerification: boolean;
};
type Detail = {
  activityId: string;
  title: string;
  totalAssigned: number;
  selfReportedCompleted: number;
  awaitingVerification: number;
  verified: number;
  pending: number;
  overdue: number;
  assignments: Row[];
};
type Filter =
  'all' | 'pending' | 'overdue' | 'reported' | 'awaiting' | 'verified';
const labels: Record<Exclude<Filter, 'all'>, string> = {
  pending: 'Pending',
  overdue: 'Overdue',
  reported: 'Self-reported complete',
  awaiting: 'Awaiting verification',
  verified: 'Verified',
};
function state(row: Row): Exclude<Filter, 'all'> {
  if (row.state === 'verified') return 'verified';
  if (row.state === 'reported')
    return row.requiresVerification ? 'awaiting' : 'reported';
  return Date.now() >= Date.parse(row.deadlineAt) ? 'overdue' : 'pending';
}

export function CounselorResults({ activityId }: { activityId: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(
    async (nextOffset: number) => {
      setLoading(true);
      setError('');
      setDetail(null);
      try {
        const body = await dashboardJson<Detail>(
          `/api/counselor/activities/${activityId}?offset=${nextOffset}`,
        );
        if (
          !Array.isArray(body.assignments) ||
          typeof body.totalAssigned !== 'number'
        )
          throw new Error('Counselor results are unavailable.');
        setDetail(body);
        setOffset(nextOffset);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Counselor results are unavailable.',
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
    detail?.assignments.filter(
      (row) => filter === 'all' || state(row) === filter,
    ) ?? [];

  return (
    <section aria-label="Counselor Activity results">
      {error && (
        <p role="alert" className="dashboard-alert">
          {error}
        </p>
      )}
      {loading && <p role="status">Loading current results…</p>}
      {detail && (
        <>
          <div className="dashboard-intro">
            <p className="dashboard-eyebrow">
              Current mapped students · Read only
            </p>
            <h1>{detail.title}</h1>
            <p>Completion reports from the existing shared Activity records.</p>
          </div>
          <CompletionProgress
            total={detail.totalAssigned}
            reported={detail.selfReportedCompleted}
            awaiting={detail.awaitingVerification}
            verified={detail.verified}
          />
          <div className="dashboard-metrics" aria-label="Mapped student totals">
            <div>
              <strong>{detail.totalAssigned}</strong>
              <span>Assigned</span>
            </div>
            <div>
              <strong>{detail.pending}</strong>
              <span>Pending</span>
            </div>
            <div>
              <strong>{detail.overdue}</strong>
              <span>Overdue</span>
            </div>
            <div>
              <strong>{detail.selfReportedCompleted}</strong>
              <span>Self-reported complete</span>
            </div>
            <div>
              <strong>{detail.awaitingVerification}</strong>
              <span>Awaiting verification</span>
            </div>
            <div>
              <strong>{detail.verified}</strong>
              <span>Verified</span>
            </div>
          </div>
          <PendingCopyButton activityId={activityId} view="counselor" />
          <div className="dashboard-toolbar">
            <p className="dashboard-muted">
              Filtering the {detail.assignments.length} students on this page.
            </p>
            <button
              type="button"
              className="dashboard-secondary"
              onClick={() => void load(offset)}
            >
              Refresh
            </button>
          </div>
          <div
            className="dashboard-filter"
            role="group"
            aria-label="Filter mapped students"
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
                onClick={() => setFilter(key as Filter)}
              >
                {label}
              </button>
            ))}
          </div>
          {rows.length ? (
            <div className="dashboard-stack">
              {rows.map((row) => (
                <article className="dashboard-list-row" key={row.assignmentId}>
                  <div>
                    <h3>{row.studentName}</h3>
                    <p>{row.studentIdentifier}</p>
                    {row.submittedAt && (
                      <p className="dashboard-muted">
                        Reported {formatWhen(row.submittedAt)}
                        {row.verifiedAt &&
                          ` · Verified ${formatWhen(row.verifiedAt)}`}
                      </p>
                    )}
                  </div>
                  <span
                    className={`dashboard-state dashboard-state-${state(row)}`}
                  >
                    {labels[state(row)]}
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <p className="dashboard-empty">
              No students on this page match that filter.
            </p>
          )}
          <div className="dashboard-actions dashboard-pagination">
            <button
              type="button"
              className="dashboard-secondary"
              disabled={offset === 0}
              onClick={() => void load(Math.max(0, offset - 50))}
            >
              Previous
            </button>
            <span>
              {detail.totalAssigned} mapped assignments · Page{' '}
              {Math.floor(offset / 50) + 1}
            </span>
            <button
              type="button"
              className="dashboard-secondary"
              disabled={offset + 50 >= detail.totalAssigned}
              onClick={() => void load(offset + 50)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}
