/* ARKST push only. No fetch interception or offline cache. */
const notificationIdPattern = /^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i;

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let id;
      try {
        id = event.data?.json()?.notificationId;
      } catch {
        return;
      }
      if (typeof id !== 'string' || !notificationIdPattern.test(id)) return;
      // The current signed-in account must still be allowed to read this inbox
      // record. A logged-out or switched-account browser fails closed.
      let preview;
      try {
        const response = await fetch(`/api/notifications/${id}/push-preview`, {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (!response.ok) return;
        preview = await response.json();
      } catch {
        return;
      }
      if (
        typeof preview.url !== 'string' ||
        !/^\/dashboard\/(student\?activity=[0-9a-f-]{36}|announcements\/[0-9a-f-]{36})$/i.test(
          preview.url,
        )
      )
        return;
      await self.registration.showNotification(preview.title, {
        body: preview.message,
        tag: id,
        data: { url: preview.url },
      });
      const windows = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const window of windows)
        window.postMessage({ type: 'arkst-push-received' });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const path = event.notification.data?.url;
      if (
        typeof path !== 'string' ||
        !/^\/dashboard\/(student\?activity=[0-9a-f-]{36}|announcements\/[0-9a-f-]{36})$/i.test(
          path,
        )
      )
        return;
      const target = new URL(path, self.location.origin);
      if (target.origin !== self.location.origin) return;
      let openError;
      try {
        const opened = await self.clients.openWindow(target.href);
        if (opened) {
          await opened.focus();
          return;
        }
      } catch (error) {
        openError = error;
      }
      const windows = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      const current = windows.find((window) =>
        window.url.startsWith(self.location.origin),
      );
      if (!current)
        throw (
          openError ?? new Error('Notification target could not be opened.')
        );
      await current.focus();
      await current.navigate(target.href);
    })(),
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const config = await fetch('/api/push/config', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (!config.ok) return;
        const { publicKey } = await config.json();
        if (typeof publicKey !== 'string') return;
        const bytes = Uint8Array.from(
          atob(publicKey.replace(/-/g, '+').replace(/_/g, '/')),
          (character) => character.charCodeAt(0),
        );
        const subscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: bytes,
        });
        const saved = await fetch('/api/push/subscription', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription),
        });
        if (!saved.ok) await subscription.unsubscribe();
      } catch {
        /* Reconciliation occurs when the user next opens ARKST. */
      }
    })(),
  );
});
