'use client';

import { useCallback, useEffect, useState } from 'react';
import { dashboardJson, formatWhen } from './dashboard-data';

export type FollowUpTarget = {
  assignmentId: string;
  studentName: string;
  studentIdentifier: string;
  deadlineAt: string;
  pending: boolean;
};
type FollowUp = {
  id: string;
  assignment_id: string;
  initiated_by: string;
  reason: string;
  status: 'open' | 'resolved';
  created_at: string;
  resolved_at: string | null;
  resolution: 'student_reported' | 'staff_closed' | null;
  resolution_note: string | null;
  activity_follow_up_history: {
    action: string;
    occurred_at: string;
    note: string | null;
  }[];
};

export function FollowUpPanel({ targets }: { targets: FollowUpTarget[] }) {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [truncated, setTruncated] = useState(false);
  const ids = targets.map((target) => target.assignmentId).join(',');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams();
      for (const id of ids.split(',').filter(Boolean))
        query.append('assignment', id);
      const body = await dashboardJson<{
        followUps: FollowUp[];
        truncated: boolean;
      }>(`/api/follow-ups?${query}`);
      if (!Array.isArray(body.followUps))
        throw new Error('Follow-up history is unavailable.');
      setFollowUps(body.followUps);
      setTruncated(body.truncated);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Follow-up history is unavailable.',
      );
    } finally {
      setLoading(false);
    }
  }, [ids]);
  useEffect(() => {
    void load();
  }, [load]);

  const open = new Set(
    followUps
      .filter((item) => item.status === 'open')
      .map((item) => item.assignment_id),
  );
  const eligible = targets.filter(
    (target) => target.pending && !open.has(target.assignmentId),
  );
  async function send() {
    if (busy || !selected.length || !reason.trim()) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const body = await dashboardJson<{ count: number }>('/api/follow-ups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentIds: selected,
          reason: reason.trim(),
        }),
      });
      await load();
      setSelected([]);
      setReason('');
      setNotice(
        `${body.count} follow-up${body.count === 1 ? '' : 's'} sent and recorded.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Follow-up could not be sent.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function resolve(id: string) {
    if (busy || !resolutionNote.trim()) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await dashboardJson(`/api/follow-ups/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: resolutionNote.trim() }),
      });
      await load();
      setResolutionNote('');
      setNotice(
        'Follow-up closed with a recorded reason. The Activity completion state is unchanged.',
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Follow-up could not be closed.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="dashboard-panel" aria-label="Activity follow-ups">
      <div className="dashboard-section-head">
        <h2>Follow-up</h2>
        <button
          type="button"
          className="dashboard-secondary"
          onClick={() => void load()}
          disabled={busy || loading}
        >
          Refresh follow-ups
        </button>
      </div>
      <p className="dashboard-muted">
        Select pending students on this page. Sends are recorded and delivered
        through their ARKST inbox; another reminder is blocked while open or for
        24 hours after closure.
      </p>
      {error && (
        <p role="alert" className="dashboard-alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {loading ? (
        <p role="status">Loading follow-up history…</p>
      ) : (
        <>
          {eligible.length ? (
            <>
              <div className="dashboard-stack">
                {eligible.map((target) => (
                  <label
                    key={target.assignmentId}
                    className="dashboard-list-row"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(target.assignmentId)}
                      disabled={busy}
                      onChange={(event) =>
                        setSelected((current) =>
                          event.target.checked
                            ? [...current, target.assignmentId]
                            : current.filter(
                                (id) => id !== target.assignmentId,
                              ),
                        )
                      }
                    />
                    <span>
                      <strong>{target.studentName}</strong> ·{' '}
                      {target.studentIdentifier}
                      <br />
                      Deadline {formatWhen(target.deadlineAt)}
                    </span>
                  </label>
                ))}
              </div>
              <label>
                Reason for follow-up
                <textarea
                  value={reason}
                  maxLength={500}
                  onChange={(event) => setReason(event.target.value)}
                  disabled={busy}
                />
              </label>
              <button
                type="button"
                disabled={busy || !selected.length || !reason.trim()}
                onClick={() => void send()}
              >
                {busy ? 'Saving…' : `Send to ${selected.length} selected`}
              </button>
            </>
          ) : (
            <p className="dashboard-empty">
              No pending student on this page is eligible for a new follow-up.
            </p>
          )}
          <h3>Recorded follow-ups</h3>
          {truncated && (
            <p className="dashboard-muted">
              Showing the newest 500 records for this page. Older records remain
              in PostgreSQL.
            </p>
          )}
          {followUps.length ? (
            <div className="dashboard-stack">
              {followUps.map((item) => {
                const target = targets.find(
                  (row) => row.assignmentId === item.assignment_id,
                );
                return (
                  <article className="dashboard-card" key={item.id}>
                    <h4>
                      {target?.studentName ?? 'Assigned student'} ·{' '}
                      {item.status === 'open' ? 'Unresolved' : 'Resolved'}
                    </h4>
                    <p>{item.reason}</p>
                    <p className="dashboard-muted">
                      Sent {formatWhen(item.created_at)} ·{' '}
                      {target?.studentIdentifier ?? ''}
                    </p>
                    {item.resolved_at && (
                      <p className="dashboard-muted">
                        Resolved {formatWhen(item.resolved_at)} ·{' '}
                        {item.resolution === 'student_reported'
                          ? 'Student reported completion'
                          : 'Staff closed with note'}
                        {item.resolution_note
                          ? `: ${item.resolution_note}`
                          : ''}
                      </p>
                    )}
                    {item.status === 'open' && (
                      <div>
                        <label>
                          Reason to close without a completion report
                          <textarea
                            value={resolutionNote}
                            maxLength={500}
                            onChange={(event) =>
                              setResolutionNote(event.target.value)
                            }
                            disabled={busy}
                          />
                        </label>
                        <button
                          type="button"
                          className="dashboard-secondary"
                          disabled={busy || !resolutionNote.trim()}
                          onClick={() => void resolve(item.id)}
                        >
                          Close follow-up
                        </button>
                      </div>
                    )}
                    <details>
                      <summary>History</summary>
                      <ul>
                        {item.activity_follow_up_history.map((event, index) => (
                          <li key={`${event.occurred_at}-${index}`}>
                            {event.action.replaceAll('_', ' ')} ·{' '}
                            {formatWhen(event.occurred_at)}
                            {event.note ? ` · ${event.note}` : ''}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="dashboard-empty">
              No follow-up has been sent for this page.
            </p>
          )}
        </>
      )}
    </section>
  );
}
