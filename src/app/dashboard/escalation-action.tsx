'use client';

import { useState } from 'react';
import { dashboardJson } from './dashboard-data';

export function EscalationAction({
  assignmentId,
  onDone,
  label = 'Escalate',
}: {
  assignmentId: string;
  onDone?: () => void;
  label?: string;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function send() {
    if (busy || !reason.trim()) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await dashboardJson<{ stage: string }>(
        '/api/escalations',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignmentId, reason: reason.trim() }),
        },
      );
      setReason('');
      setNotice(
        `Escalation recorded and sent to the current ${result.stage.replaceAll('_', ' ')}.`,
      );
      onDone?.();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Escalation was not saved.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="dashboard-card">
      <label>
        Reason to escalate
        <textarea
          maxLength={500}
          value={reason}
          disabled={busy}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <button
        type="button"
        className="dashboard-secondary"
        disabled={busy || !reason.trim()}
        onClick={() => void send()}
      >
        {busy ? 'Saving…' : label}
      </button>
      {error && (
        <p role="alert" className="dashboard-alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}
