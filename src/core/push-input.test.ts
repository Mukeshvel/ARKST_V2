import { describe, expect, it } from 'vitest';
import {
  allowedPushEndpoint,
  pushEndpointInput,
  pushSubscriptionInput,
} from './push-input';

const valid = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/synthetic-local-token',
  expirationTime: null,
  keys: { p256dh: 'A'.repeat(87), auth: 'B'.repeat(22) },
};

describe('push input boundaries', () => {
  it('accepts a supported HTTPS push service and bounded encryption keys', () => {
    expect(pushSubscriptionInput(valid)).toEqual({
      p_endpoint: valid.endpoint,
      p_p256dh: valid.keys.p256dh,
      p_auth: valid.keys.auth,
      p_expires_at: null,
    });
  });
  it.each([
    'http://fcm.googleapis.com/fcm/send/x',
    'https://127.0.0.1/private',
    'https://fcm.googleapis.com.evil.test/fcm/send/x',
    'https://user@fcm.googleapis.com/fcm/send/x',
    'https://fcm.googleapis.com:8443/fcm/send/x',
  ])('rejects an unsafe endpoint: %s', (endpoint) => {
    expect(allowedPushEndpoint(endpoint)).toBe(false);
    expect(() => pushEndpointInput({ endpoint })).toThrow();
  });
  it('rejects missing or expired browser encryption details', () => {
    expect(() => pushSubscriptionInput({ ...valid, keys: {} })).toThrow();
    expect(() =>
      pushSubscriptionInput({ ...valid, expirationTime: Date.now() - 1000 }),
    ).toThrow();
  });
});
