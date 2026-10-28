'use client';

import { useCallback, useEffect, useState } from 'react';
import { dashboardJson } from '../dashboard-data';

type Status =
  'checking' | 'unsupported' | 'blocked' | 'not_enabled' | 'enabled';

function browserSupported() {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function applicationKey(value: string) {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function PushControl() {
  const [status, setStatus] = useState<Status>('checking');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    if (!browserSupported()) {
      setStatus('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setStatus('blocked');
      return;
    }
    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) {
        setStatus('not_enabled');
        return;
      }
      const result = await dashboardJson<{ enabled: boolean }>(
        '/api/push/subscription',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        },
      );
      setStatus(result.enabled ? 'enabled' : 'not_enabled');
    } catch (error) {
      setStatus('not_enabled');
      setMessage(
        error instanceof Error ? error.message : 'Push status is unavailable.',
      );
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function enable() {
    if (!browserSupported()) return;
    setBusy(true);
    setMessage('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'blocked' : 'not_enabled');
        setMessage(
          'Desktop permission was not granted. Your ARKST inbox still works.',
        );
        return;
      }
      const { publicKey } = await dashboardJson<{ publicKey: string }>(
        '/api/push/config',
      );
      const registration = await navigator.serviceWorker.register(
        '/arkst-push-sw.js',
        {
          scope: '/',
          updateViaCache: 'none',
        },
      );
      await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        const stored = await dashboardJson<{ enabled: boolean }>(
          '/api/push/subscription',
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: existing.endpoint }),
          },
        );
        if (!stored.enabled && !(await existing.unsubscribe()))
          throw new Error(
            'Previous browser subscription could not be replaced.',
          );
      }
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationKey(publicKey),
        }));
      try {
        const saved = await dashboardJson<{ enabled: boolean }>(
          '/api/push/subscription',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subscription),
          },
        );
        if (!saved.enabled) throw new Error('Subscription was not saved.');
      } catch (error) {
        await subscription.unsubscribe();
        throw error;
      }
      setStatus('enabled');
      setMessage('Desktop notifications enabled for this browser.');
    } catch (error) {
      await refresh();
      setMessage(
        error instanceof Error
          ? error.message
          : 'Desktop notifications could not be enabled.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!browserSupported()) return;
    setBusy(true);
    setMessage('');
    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) throw new Error('No browser subscription is present.');
      const result = await dashboardJson<{ disabled: boolean }>(
        '/api/push/subscription',
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        },
      );
      if (!result.disabled)
        throw new Error('Server did not confirm disabling.');
      if (!(await subscription.unsubscribe()))
        throw new Error('Server disabled push, but browser cleanup failed.');
      setStatus('not_enabled');
      setMessage('Desktop notifications disabled for this browser.');
    } catch (error) {
      await refresh();
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not disable desktop notifications.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="dashboard-panel" aria-label="Desktop notifications">
      <h2>Desktop notifications</h2>
      <p className="dashboard-muted">
        {status === 'checking' && 'Checking this browser…'}
        {status === 'unsupported' &&
          'Unavailable in this browser or without a secure connection.'}
        {status === 'blocked' &&
          'Blocked in browser settings. Your in-app inbox still works.'}
        {status === 'not_enabled' &&
          'Not enabled on this browser. Your in-app inbox still works.'}
        {status === 'enabled' &&
          'Enabled on this browser. Push depends on browser and device availability.'}
      </p>
      {status === 'not_enabled' && (
        <button
          type="button"
          className="dashboard-secondary"
          disabled={busy}
          onClick={() => void enable()}
        >
          {busy ? 'Enabling…' : 'Enable desktop notifications'}
        </button>
      )}
      {status === 'enabled' && (
        <button
          type="button"
          className="dashboard-secondary"
          disabled={busy}
          onClick={() => void disable()}
        >
          {busy ? 'Disabling…' : 'Disable desktop notifications'}
        </button>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
