import {
  activityRequest,
  requireEmptyActivityJson,
} from '@/auth/activity-http';
import { activityId } from '@/core/activity-input';
import { changeCompletion } from '@/data/activities';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return activityRequest(request, true, async (client) => {
    await requireEmptyActivityJson(request);
    return changeCompletion(
      client,
      activityId((await context.params).id),
      false,
    );
  });
}
