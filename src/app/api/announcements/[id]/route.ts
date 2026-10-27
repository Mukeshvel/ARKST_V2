import { activityRequest } from '@/auth/activity-http';
import { activityId } from '@/core/activity-input';
import { getAnnouncement } from '@/data/activities';

export const dynamic = 'force-dynamic';
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return activityRequest(request, false, async (client) =>
    getAnnouncement(client, activityId((await context.params).id)),
  );
}
