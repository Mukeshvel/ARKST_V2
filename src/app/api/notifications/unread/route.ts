import { activityRequest } from '@/auth/activity-http';
import { ActivityError } from '@/core/activity-input';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return activityRequest(request, false, async (client) => {
    const { count, error } = await client
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null);
    if (error || count === null)
      throw new ActivityError(503, 'Unread count is unavailable.');
    return { unread: count };
  });
}
