'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { dashboardJson, formatWhen } from '../dashboard-data';

type Notification = {
  id: string;
  source_kind: 'activity' | 'announcement';
  source_id: string;
  title: string;
  message: string;
  created_at: string;
  read_at: string | null;
};

export function NotificationInbox() {
  const [rows, setRows] = useState<Notification[]>([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const load = useCallback(async (nextOffset: number) => {
    setLoading(true);
    setError('');
    try {
      const body = await dashboardJson<{
        notifications: Notification[];
        total: number;
        unread: number;
      }>(`/api/notifications?offset=${nextOffset}`);
      if (
        !Array.isArray(body.notifications) ||
        typeof body.total !== 'number' ||
        typeof body.unread !== 'number'
      )
        throw new Error('Inbox is unavailable.');
      setRows(body.notifications);
      setTotal(body.total);
      setUnread(body.unread);
      setOffset(nextOffset);
    } catch (cause) {
      setRows([]);
      setTotal(0);
      setUnread(0);
      setError(
        cause instanceof Error ? cause.message : 'Inbox is unavailable.',
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load(0);
  }, [load]);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') void load(offset);
    };
    const timer = window.setInterval(refresh, 20000);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    navigator.serviceWorker?.addEventListener('message', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refresh);
      navigator.serviceWorker?.removeEventListener('message', refresh);
    };
  }, [load, offset]);

  async function changeRead(id: string, read: boolean) {
    if (busyId) return;
    setBusyId(id);
    setError('');
    try {
      await dashboardJson(
        `/api/notifications/${id}/${read ? 'read' : 'unread'}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        },
      );
      await load(offset);
      window.dispatchEvent(new Event('arkst-inbox-changed'));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Read state could not be saved.',
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="dashboard-panel" aria-label="Notifications">
      <div className="dashboard-section-head">
        <h2>{loading ? 'Inbox' : `${unread} unread`}</h2>
        <button
          className="dashboard-secondary"
          type="button"
          disabled={loading}
          onClick={() => void load(offset)}
        >
          Refresh inbox
        </button>
      </div>
      {error && (
        <p role="alert" className="dashboard-alert">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Loading inbox…</p>
      ) : error ? null : rows.length ? (
        <div className="dashboard-stack">
          {rows.map((row) => {
            const href =
              row.source_kind === 'activity'
                ? `/dashboard/student?activity=${row.source_id}`
                : `/dashboard/announcements/${row.source_id}`;
            return (
              <article className="dashboard-card" key={row.id}>
                <div className="dashboard-card-head">
                  <div>
                    <p className="dashboard-eyebrow">
                      {row.source_kind} · {row.read_at ? 'Read' : 'Unread'}
                    </p>
                    <h3>{row.title}</h3>
                  </div>
                </div>
                <p>{row.message}</p>
                <p className="dashboard-muted">{formatWhen(row.created_at)}</p>
                <div className="dashboard-actions">
                  <Link href={href}>Open {row.source_kind}</Link>
                  <button
                    type="button"
                    className="dashboard-secondary"
                    disabled={busyId !== null}
                    onClick={() => void changeRead(row.id, !row.read_at)}
                  >
                    {busyId === row.id
                      ? 'Saving…'
                      : row.read_at
                        ? 'Mark unread'
                        : 'Mark read'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="dashboard-empty">
          No notifications have been sent to your account.
        </p>
      )}
      {!error && (
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
            {total} notifications · Page {Math.floor(offset / 50) + 1}
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
      )}
    </section>
  );
}
