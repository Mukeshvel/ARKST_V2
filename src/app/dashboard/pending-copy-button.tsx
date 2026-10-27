'use client';

import { useState } from 'react';
import { dashboardJson } from './dashboard-data';

export function PendingCopyButton({
  activityId,
  view,
}: {
  activityId: string;
  view: 'creator' | 'counselor';
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  async function copy() {
    if (busy) return;
    setBusy(true);
    setStatus('');
    setError('');
    try {
      const body = await dashboardJson<{ text: string; count: number }>(
        `/api/activities/${activityId}/pending?view=${view}`,
      );
      if (typeof body.text !== 'string' || typeof body.count !== 'number')
        throw new Error(
          'The complete pending list is unavailable. Nothing was copied.',
        );
      if (!navigator.clipboard?.writeText)
        throw new Error(
          'Clipboard access is unavailable in this browser. Nothing was copied.',
        );
      await navigator.clipboard.writeText(body.text);
      setStatus(
        `Copied the complete list of ${body.count} pending student${body.count === 1 ? '' : 's'}.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Copy failed. Nothing was copied.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="dashboard-copy">
      <button
        type="button"
        className="dashboard-secondary"
        disabled={busy}
        onClick={() => void copy()}
      >
        {busy ? 'Preparing full list…' : 'Copy Pending Students'}
      </button>
      {status && <p role="status">{status}</p>}
      {error && (
        <p role="alert" className="dashboard-alert">
          {error}
        </p>
      )}
    </div>
  );
}
