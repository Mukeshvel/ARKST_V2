'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { dashboardJson, formatWhen } from '../dashboard-data';
import { EscalationAction } from '../escalation-action';

type Item = {
  assignmentId: string;
  activityId: string;
  title: string;
  deadlineAt: string;
  studentName: string;
  studentIdentifier: string;
  outstandingCount: number;
  reasons: string[];
};
type MissedInformation = {
  id: string;
  studentName: string;
  studentIdentifier: string;
  subject: string;
  missedInformation: string;
  status: 'submitted' | 'approved';
  createdAt: string;
  canReview: boolean;
};
type Escalation = {
  id: string;
  assignmentId: string;
  activityId: string;
  activityTitle: string;
  studentName: string;
  studentIdentifier: string;
  stage: string;
  reason: string;
  status: 'open' | 'advanced' | 'resolved';
  createdAt: string;
  closedAt: string | null;
  resolutionNote: string | null;
  isRecipient: boolean;
  history: { action: string; occurredAt: string; note: string | null }[];
};

export function AttentionBoard({ kind }: { kind: 'student' | 'staff' }) {
  const [items, setItems] = useState<Item[]>([]);
  const [attentionTotal, setAttentionTotal] = useState(0);
  const [attentionOffset, setAttentionOffset] = useState(0);
  const [attentionError, setAttentionError] = useState('');
  const [attentionLoading, setAttentionLoading] = useState(kind === 'staff');
  const [missed, setMissed] = useState<MissedInformation[]>([]);
  const [missedTotal, setMissedTotal] = useState(0);
  const [missedOffset, setMissedOffset] = useState(0);
  const [missedError, setMissedError] = useState('');
  const [missedLoading, setMissedLoading] = useState(kind === 'staff');
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [escalationTotal, setEscalationTotal] = useState(0);
  const [escalationOffset, setEscalationOffset] = useState(0);
  const [escalationError, setEscalationError] = useState('');
  const [escalationLoading, setEscalationLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const loadAttention = useCallback(async (offset: number) => {
    setAttentionLoading(true);
    setAttentionError('');
    try {
      const body = await dashboardJson<{ items: Item[]; total: number }>(
        `/api/attention?offset=${offset}`,
      );
      if (!Array.isArray(body.items) || typeof body.total !== 'number')
        throw new Error('Attention view is unavailable.');
      setItems(body.items);
      setAttentionTotal(body.total);
      setAttentionOffset(offset);
    } catch (cause) {
      setAttentionError(
        cause instanceof Error
          ? cause.message
          : 'Attention view is unavailable.',
      );
    } finally {
      setAttentionLoading(false);
    }
  }, []);
  const loadEscalations = useCallback(async (offset: number) => {
    setEscalationLoading(true);
    setEscalationError('');
    try {
      const body = await dashboardJson<{
        escalations: Escalation[];
        total: number;
      }>(`/api/escalations?offset=${offset}`);
      if (!Array.isArray(body.escalations) || typeof body.total !== 'number')
        throw new Error('Escalations are unavailable.');
      setEscalations(body.escalations);
      setEscalationTotal(body.total);
      setEscalationOffset(offset);
    } catch (cause) {
      setEscalationError(
        cause instanceof Error ? cause.message : 'Escalations are unavailable.',
      );
    } finally {
      setEscalationLoading(false);
    }
  }, []);
  const loadMissed = useCallback(async (offset: number) => {
    setMissedLoading(true);
    setMissedError('');
    try {
      const body = await dashboardJson<{
        requests: MissedInformation[];
        total: number;
      }>(`/api/attention/missed?offset=${offset}`);
      if (!Array.isArray(body.requests) || typeof body.total !== 'number')
        throw new Error('Missed-information view is unavailable.');
      setMissed(body.requests);
      setMissedTotal(body.total);
      setMissedOffset(offset);
    } catch (cause) {
      setMissedError(
        cause instanceof Error
          ? cause.message
          : 'Missed-information view is unavailable.',
      );
    } finally {
      setMissedLoading(false);
    }
  }, []);
  useEffect(() => {
    if (kind === 'staff') {
      void loadAttention(0);
      void loadMissed(0);
    }
    void loadEscalations(0);
  }, [kind, loadAttention, loadEscalations, loadMissed]);
  async function resolve(id: string) {
    if (busy || !notes[id]?.trim()) return;
    setBusy(true);
    setEscalationError('');
    setNotice('');
    try {
      await dashboardJson(`/api/escalations/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: notes[id].trim() }),
      });
      await loadEscalations(escalationOffset);
      setNotes((current) => ({ ...current, [id]: '' }));
      setNotice(
        'Escalation resolved with a recorded note. Activity completion is unchanged.',
      );
    } catch (cause) {
      setEscalationError(
        cause instanceof Error ? cause.message : 'Resolution was not saved.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {kind === 'staff' && (
        <section className="dashboard-panel" aria-label="Attention needed">
          <div className="dashboard-section-head">
            <h2>Current pending students</h2>
            <button
              type="button"
              className="dashboard-secondary"
              disabled={attentionLoading}
              onClick={() => void loadAttention(attentionOffset)}
            >
              Refresh
            </button>
          </div>
          <p className="dashboard-muted">
            Reasons are recorded conditions, not a risk score. This view
            contains only assignments in your current follow-up scope.
          </p>
          {attentionError && (
            <p role="alert" className="dashboard-alert">
              {attentionError}
            </p>
          )}
          {attentionLoading ? (
            <p role="status">Loading attention list…</p>
          ) : items.length ? (
            <div className="dashboard-stack">
              {items.map((item) => (
                <article className="dashboard-card" key={item.assignmentId}>
                  <h3>
                    {item.studentName} · {item.studentIdentifier}
                  </h3>
                  <p>
                    {item.title} · Deadline {formatWhen(item.deadlineAt)}
                  </p>
                  <p>
                    <strong>Why:</strong> {item.reasons.join('; ')}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="dashboard-empty">
              No current assignment meets the attention rules in your scope.
            </p>
          )}
          <div className="dashboard-actions dashboard-pagination">
            <button
              type="button"
              className="dashboard-secondary"
              disabled={attentionLoading || attentionOffset === 0}
              onClick={() =>
                void loadAttention(Math.max(0, attentionOffset - 50))
              }
            >
              Previous
            </button>
            <span>
              {attentionTotal} items · Page{' '}
              {Math.floor(attentionOffset / 50) + 1}
            </span>
            <button
              type="button"
              className="dashboard-secondary"
              disabled={
                attentionLoading || attentionOffset + 50 >= attentionTotal
              }
              onClick={() => void loadAttention(attentionOffset + 50)}
            >
              Next
            </button>
          </div>
        </section>
      )}
      {kind === 'staff' && (
        <section
          className="dashboard-panel"
          aria-label="Missed academic information"
        >
          <div className="dashboard-section-head">
            <h2>Missed academic information</h2>
            <button
              type="button"
              className="dashboard-secondary"
              disabled={missedLoading}
              onClick={() => void loadMissed(missedOffset)}
            >
              Refresh
            </button>
          </div>
          <p className="dashboard-muted">
            Submitted or approved requests in your current authorized section or
            counselor mapping, including students with no pending Activity.
          </p>
          {missedError && (
            <p role="alert" className="dashboard-alert">
              {missedError}
            </p>
          )}
          {missedLoading ? (
            <p role="status">Loading missed information…</p>
          ) : missed.length ? (
            <div className="dashboard-stack">
              {missed.map((request) => (
                <article className="dashboard-card" key={request.id}>
                  <p className="dashboard-eyebrow">
                    {request.status} · {formatWhen(request.createdAt)}
                  </p>
                  <h3>
                    {request.studentName} · {request.studentIdentifier}
                  </h3>
                  <p>
                    <strong>Why:</strong> {request.subject}
                  </p>
                  <p>{request.missedInformation}</p>
                  {request.canReview ? (
                    <Link href="/dashboard/catch-up">
                      Review or publish in Catch-up
                    </Link>
                  ) : (
                    <p className="dashboard-muted">
                      Counselor monitoring only. Official review requires
                      approved general CREATE authority.
                    </p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="dashboard-empty">
              No unresolved missed-information request is visible in your scope.
            </p>
          )}
          <div className="dashboard-actions dashboard-pagination">
            <button
              type="button"
              className="dashboard-secondary"
              disabled={missedLoading || missedOffset === 0}
              onClick={() => void loadMissed(Math.max(0, missedOffset - 50))}
            >
              Previous
            </button>
            <span>
              {missedTotal} requests · Page {Math.floor(missedOffset / 50) + 1}
            </span>
            <button
              type="button"
              className="dashboard-secondary"
              disabled={missedLoading || missedOffset + 50 >= missedTotal}
              onClick={() => void loadMissed(missedOffset + 50)}
            >
              Next
            </button>
          </div>
        </section>
      )}
      <section className="dashboard-panel" aria-label="Escalations">
        <div className="dashboard-section-head">
          <h2>Escalation history</h2>
          <button
            type="button"
            className="dashboard-secondary"
            disabled={escalationLoading}
            onClick={() => void loadEscalations(escalationOffset)}
          >
            Refresh
          </button>
        </div>
        {escalationError && (
          <p role="alert" className="dashboard-alert">
            {escalationError}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        {escalationLoading ? (
          <p role="status">Loading escalations…</p>
        ) : escalations.length ? (
          <div className="dashboard-stack">
            {escalations.map((row) => (
              <article className="dashboard-card" key={row.id}>
                <p className="dashboard-eyebrow">
                  {row.stage.replaceAll('_', ' ')} · {row.status}
                </p>
                <h3>{row.activityTitle}</h3>
                {kind === 'staff' && (
                  <p className="dashboard-muted">
                    {row.studentName} · {row.studentIdentifier}
                  </p>
                )}
                <p>{row.reason}</p>
                <p className="dashboard-muted">
                  Sent {formatWhen(row.createdAt)}
                  {row.closedAt ? ` · Closed ${formatWhen(row.closedAt)}` : ''}
                </p>
                {row.resolutionNote && <p>Resolution: {row.resolutionNote}</p>}
                {row.status === 'open' &&
                  row.isRecipient &&
                  row.stage === 'coordinator' && (
                    <details>
                      <summary>Advance to branch coordinator or HOD</summary>
                      <EscalationAction
                        assignmentId={row.assignmentId}
                        onDone={() => void loadEscalations(escalationOffset)}
                        label="Advance escalation"
                      />
                    </details>
                  )}
                {row.status === 'open' && row.isRecipient && (
                  <div>
                    <label>
                      Resolution note
                      <textarea
                        maxLength={500}
                        value={notes[row.id] ?? ''}
                        disabled={busy}
                        onChange={(event) =>
                          setNotes((current) => ({
                            ...current,
                            [row.id]: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="dashboard-secondary"
                      disabled={busy || !notes[row.id]?.trim()}
                      onClick={() => void resolve(row.id)}
                    >
                      Resolve escalation
                    </button>
                  </div>
                )}
                <details>
                  <summary>History</summary>
                  <ul>
                    {row.history.map((event, index) => (
                      <li key={`${event.occurredAt}-${index}`}>
                        {event.action.replaceAll('_', ' ')} ·{' '}
                        {formatWhen(event.occurredAt)}
                        {event.note ? ` · ${event.note}` : ''}
                      </li>
                    ))}
                  </ul>
                </details>
              </article>
            ))}
          </div>
        ) : (
          <p className="dashboard-empty">
            No escalations are visible in your current scope.
          </p>
        )}
        <div className="dashboard-actions dashboard-pagination">
          <button
            type="button"
            className="dashboard-secondary"
            disabled={escalationLoading || escalationOffset === 0}
            onClick={() =>
              void loadEscalations(Math.max(0, escalationOffset - 50))
            }
          >
            Previous
          </button>
          <span>
            {escalationTotal} escalations · Page{' '}
            {Math.floor(escalationOffset / 50) + 1}
          </span>
          <button
            type="button"
            className="dashboard-secondary"
            disabled={
              escalationLoading || escalationOffset + 50 >= escalationTotal
            }
            onClick={() => void loadEscalations(escalationOffset + 50)}
          >
            Next
          </button>
        </div>
      </section>
    </>
  );
}
