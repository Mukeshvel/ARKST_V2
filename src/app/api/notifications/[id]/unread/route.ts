import {
  activityRequest,
  requireEmptyActivityJson,
} from '@/auth/activity-http';
import { activityId } from '@/core/activity-input';
import { markNotificationUnread } from '@/data/push';

export const dynamic = 'force-dynamic';
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return activityRequest(request, true, async (client) => {
    await requireEmptyActivityJson(request);
    return markNotificationUnread(
      client,
      activityId((await context.params).id),
    );
  });
}
