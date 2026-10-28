'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { dashboardJson } from './dashboard-data';

export function InboxLink() {
  const [unread, setUnread] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const response = await dashboardJson<{ unread: number }>(
        '/api/notifications/unread',
      );
      if (!Number.isInteger(response.unread))
        throw new Error('Invalid unread count.');
      setUnread(response.unread);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 30000);
    const onWake = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', onWake);
    window.addEventListener('online', onWake);
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('arkst-inbox-changed', onWake);
    navigator.serviceWorker?.addEventListener('message', onWake);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onWake);
      window.removeEventListener('online', onWake);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('arkst-inbox-changed', onWake);
      navigator.serviceWorker?.removeEventListener('message', onWake);
    };
  }, [refresh]);
  return (
    <Link
      href="/dashboard/notifications"
      aria-label={
        error
          ? 'Inbox count unavailable'
          : `Inbox${unread ? `, ${unread} unread` : ''}`
      }
    >
      Inbox{unread !== null && unread > 0 ? ` (${unread})` : ''}
      {error ? ' · sync unavailable' : ''}
    </Link>
  );
}
