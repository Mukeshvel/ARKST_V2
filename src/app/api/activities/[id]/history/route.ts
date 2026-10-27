import { activityRequest } from '@/auth/activity-http';
import { activityId, activityOffset } from '@/core/activity-input';
import { activityHistory } from '@/data/activities';

export const dynamic = 'force-dynamic';
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return activityRequest(request, false, async (client) =>
    activityHistory(
      client,
      activityId((await context.params).id),
      activityOffset(request.url),
    ),
  );
}
