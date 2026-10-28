import { ActivityError } from './activity-input';

export function allowedPushEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length < 20 || value.length > 2048)
    return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.hash &&
      (url.port === '' || url.port === '443') &&
      (host === 'fcm.googleapis.com' ||
        host === 'updates.push.services.mozilla.com' ||
        host === 'web.push.apple.com' ||
        host === 'wns.notify.windows.com' ||
        host.endsWith('.notify.windows.com')) &&
      url.pathname.length > 1
    );
  } catch {
    return false;
  }
}

export function pushEndpointInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ActivityError(400, 'Invalid push subscription request.');
  const endpoint = (value as Record<string, unknown>).endpoint;
  if (!allowedPushEndpoint(endpoint))
    throw new ActivityError(400, 'Unsupported push service endpoint.');
  return endpoint;
}

export function pushSubscriptionInput(value: unknown) {
  const endpoint = pushEndpointInput(value);
  const record = value as Record<string, unknown>;
  const keys = record.keys;
  if (!keys || typeof keys !== 'object' || Array.isArray(keys))
    throw new ActivityError(400, 'Push encryption keys are required.');
  const p256dh = (keys as Record<string, unknown>).p256dh;
  const auth = (keys as Record<string, unknown>).auth;
  const expires = record.expirationTime;
  if (
    typeof p256dh !== 'string' ||
    !/^[A-Za-z0-9_-]{40,180}$/.test(p256dh) ||
    typeof auth !== 'string' ||
    !/^[A-Za-z0-9_-]{16,100}$/.test(auth) ||
    (expires !== null &&
      expires !== undefined &&
      (typeof expires !== 'number' ||
        !Number.isFinite(expires) ||
        expires <= Date.now() ||
        expires > Date.now() + 366 * 86400000))
  )
    throw new ActivityError(400, 'Invalid push subscription data.');
  return {
    p_endpoint: endpoint,
    p_p256dh: p256dh,
    p_auth: auth,
    p_expires_at:
      typeof expires === 'number' ? new Date(expires).toISOString() : null,
  };
}
