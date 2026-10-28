import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ActivityError } from '@/core/activity-input';
import type { pushSubscriptionInput } from '@/core/push-input';

function pushResult<T>(data: T, error: { code?: string } | null): T {
  if (error) {
    if (error.code === '42501')
      throw new ActivityError(403, 'Push subscription is unavailable.');
    if (error.code === '22023')
      throw new ActivityError(400, 'Invalid push subscription.');
    console.error(
      'Push database operation failed; code:',
      error.code ?? 'unknown',
    );
    throw new ActivityError(503, 'Push settings could not be saved.');
  }
  return data;
}

export async function registerPushSubscription(
  client: SupabaseClient,
  input: ReturnType<typeof pushSubscriptionInput>,
) {
  const { data, error } = await client.rpc('register_push_subscription', input);
  return { enabled: pushResult(data, error) === true };
}

export async function pushSubscriptionStatus(
  client: SupabaseClient,
  endpoint: string,
) {
  const { data, error } = await client.rpc('push_subscription_status', {
    p_endpoint: endpoint,
  });
  return { enabled: pushResult(data, error) === true };
}

export async function disablePushSubscription(
  client: SupabaseClient,
  endpoint: string,
) {
  const { data, error } = await client.rpc('disable_push_subscription', {
    p_endpoint: endpoint,
  });
  return { disabled: pushResult(data, error) === true };
}

export async function markNotificationUnread(
  client: SupabaseClient,
  id: string,
) {
  const { data, error } = await client.rpc('mark_notification_unread', {
    p_notification: id,
  });
  if (error) {
    if (error.code === '42501')
      throw new ActivityError(403, 'Notification is unavailable.');
    console.error(
      'Notification read-state operation failed; code:',
      error.code ?? 'unknown',
    );
    throw new ActivityError(503, 'Notification read state could not be saved.');
  }
  return data;
}
