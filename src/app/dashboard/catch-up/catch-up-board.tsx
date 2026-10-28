'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { dashboardJson, formatWhen } from '../dashboard-data';

type CatchUp = {
  id: string;
  studentId: string;
  studentName: string;
  studentIdentifier: string;
  subject: string;
  missedInformation: string;
  status: 'submitted' | 'approved' | 'rejected' | 'published';
  createdAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  announcementId: string | null;
  departmentId: string;
  sectionId: string;
  history: { action: string; occurredAt: string; note: string | null }[];
};

export function CatchUpBoard({ kind }: { kind: 'student' | 'staff' }) {
  const [rows, setRows] = useState<CatchUp[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [subject, setSubject] = useState('');
  const [information, setInformation] = useState('');
  const [rejection, setRejection] = useState<Record<string, string>>({});
  const [publication, setPublication] = useState<
    Record<
      string,
      { title: string; message: string; audience: 'requester' | 'section' }
    >
  >({});
  const load = useCallback(async (nextOffset: number) => {
    setLoading(true);
    setError('');
    try {
      const body = await dashboardJson<{ requests: CatchUp[]; total: number }>(
        `/api/catch-up?offset=${nextOffset}`,
      );
      if (!Array.isArray(body.requests) || typeof body.total !== 'number')
        throw new Error('Catch-up requests are unavailable.');
      setRows(body.requests);
      setTotal(body.total);
      setOffset(nextOffset);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Catch-up requests are unavailable.',
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load(0);
  }, [load]);
  async function submit() {
    if (busy || !subject.trim() || !information.trim()) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await dashboardJson('/api/catch-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          missedInformation: information.trim(),
        }),
      });
      await load(0);
      setSubject('');
      setInformation('');
      setNotice('Your request was recorded for authorized staff review.');
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Request was not saved.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function review(id: string, approve: boolean) {
    if (busy || (!approve && !rejection[id]?.trim())) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await dashboardJson(`/api/catch-up/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          approve
            ? { approve: true }
            : { approve: false, reason: rejection[id]!.trim() },
        ),
      });
      await load(offset);
      setNotice(
        approve
          ? 'Request approved. Publish official information below.'
          : 'Request rejected with the recorded reason.',
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Review was not saved.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function publish(row: CatchUp) {
    const draft = publication[row.id];
    if (busy || !draft?.title.trim() || !draft.message.trim()) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const body = await dashboardJson<{ recipientCount: number }>(
        `/api/catch-up/${row.id}/publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            departmentScopeId: row.departmentId,
            mode: draft.audience === 'requester' ? 'selected' : 'sections',
            ...(draft.audience === 'requester'
              ? { studentIds: [row.studentId] }
              : { sectionIds: [row.sectionId] }),
            title: draft.title.trim(),
            message: draft.message.trim(),
          }),
        },
      );
      await load(offset);
      setNotice(
        `Official information published to ${body.recipientCount} permitted student${body.recipientCount === 1 ? '' : 's'}.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Publication was not saved.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="dashboard-panel" aria-label="Catch-up workflow">
      {error && (
        <p role="alert" className="dashboard-alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {kind === 'student' && (
        <div className="dashboard-card">
          <h2>Report missed information</h2>
          <p className="dashboard-muted">
            Describe the information or deadline you missed. This is a request
            for review; it does not reopen an Activity or publish an
            announcement.
          </p>
          <label>
            Subject
            <input
              value={subject}
              maxLength={160}
              onChange={(event) => setSubject(event.target.value)}
              disabled={busy}
            />
          </label>
          <label>
            What did you miss?
            <textarea
              value={information}
              maxLength={3000}
              onChange={(event) => setInformation(event.target.value)}
              disabled={busy}
            />
          </label>
          <button
            type="button"
            disabled={busy || !subject.trim() || !information.trim()}
            onClick={() => void submit()}
          >
            {busy ? 'Saving…' : 'Submit request'}
          </button>
        </div>
      )}
      <div className="dashboard-section-head">
        <h2>
          {kind === 'student'
            ? 'My requests'
            : 'Requests in my approved sections'}
        </h2>
        <button
          type="button"
          className="dashboard-secondary"
          disabled={loading || busy}
          onClick={() => void load(offset)}
        >
          Refresh
        </button>
      </div>
      {loading ? (
        <p role="status">Loading requests…</p>
      ) : rows.length ? (
        <div className="dashboard-stack">
          {rows.map((row) => {
            const draft = publication[row.id] ?? {
              title: '',
              message: '',
              audience: 'requester' as const,
            };
            return (
              <article className="dashboard-card" key={row.id}>
                <p className="dashboard-eyebrow">
                  {row.status} · {formatWhen(row.createdAt)}
                </p>
                <h3>{row.subject}</h3>
                {kind === 'staff' && (
                  <p className="dashboard-muted">
                    {row.studentName} · {row.studentIdentifier}
                  </p>
                )}
                <p>{row.missedInformation}</p>
                {row.rejectionReason && (
                  <p>Rejection reason: {row.rejectionReason}</p>
                )}
                {row.announcementId && (
                  <Link href={`/dashboard/announcements/${row.announcementId}`}>
                    Open published announcement
                  </Link>
                )}
                {kind === 'staff' && row.status === 'submitted' && (
                  <div className="dashboard-stack">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void review(row.id, true)}
                    >
                      Approve for publication
                    </button>
                    <label>
                      Reason to reject
                      <textarea
                        maxLength={500}
                        value={rejection[row.id] ?? ''}
                        disabled={busy}
                        onChange={(event) =>
                          setRejection((current) => ({
                            ...current,
                            [row.id]: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="dashboard-secondary"
                      disabled={busy || !rejection[row.id]?.trim()}
                      onClick={() => void review(row.id, false)}
                    >
                      Reject with reason
                    </button>
                  </div>
                )}
                {kind === 'staff' && row.status === 'approved' && (
                  <div className="dashboard-stack">
                    <p className="dashboard-muted">
                      Write and verify the official message. The student request
                      is never published automatically.
                    </p>
                    <label>
                      Official title
                      <input
                        maxLength={160}
                        value={draft.title}
                        disabled={busy}
                        onChange={(event) =>
                          setPublication((current) => ({
                            ...current,
                            [row.id]: { ...draft, title: event.target.value },
                          }))
                        }
                      />
                    </label>
                    <label>
                      Official information
                      <textarea
                        maxLength={5000}
                        value={draft.message}
                        disabled={busy}
                        onChange={(event) =>
                          setPublication((current) => ({
                            ...current,
                            [row.id]: { ...draft, message: event.target.value },
                          }))
                        }
                      />
                    </label>
                    <label>
                      Audience
                      <select
                        value={draft.audience}
                        disabled={busy}
                        onChange={(event) =>
                          setPublication((current) => ({
                            ...current,
                            [row.id]: {
                              ...draft,
                              audience: event.target.value as
                                'requester' | 'section',
                            },
                          }))
                        }
                      >
                        <option value="requester">
                          Requesting student only
                        </option>
                        <option value="section">
                          Section recorded with this request
                        </option>
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={
                        busy || !draft.title.trim() || !draft.message.trim()
                      }
                      onClick={() => void publish(row)}
                    >
                      Publish official announcement
                    </button>
                  </div>
                )}
                <details>
                  <summary>Recorded history</summary>
                  <ul>
                    {row.history.map((event, index) => (
                      <li key={`${event.occurredAt}-${index}`}>
                        {event.action} · {formatWhen(event.occurredAt)}
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
          No catch-up requests are visible in your current scope.
        </p>
      )}
      <div className="dashboard-actions dashboard-pagination">
        <button
          type="button"
          className="dashboard-secondary"
          disabled={loading || offset === 0}
          onClick={() => void load(Math.max(0, offset - 50))}
        >
          Previous
        </button>
        <span>
          {total} requests · Page {Math.floor(offset / 50) + 1}
        </span>
        <button
          type="button"
          className="dashboard-secondary"
          disabled={loading || offset + 50 >= total}
          onClick={() => void load(offset + 50)}
        >
          Next
        </button>
      </div>
    </section>
  );
}
