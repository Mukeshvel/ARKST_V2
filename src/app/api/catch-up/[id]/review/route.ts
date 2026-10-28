import { activityRequest, readActivityJson } from '@/auth/activity-http';
import { activityId, catchUpReviewInput } from '@/core/activity-input';
import { reviewCatchUpRequest } from '@/data/activities';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return activityRequest(request, true, async (client) =>
    reviewCatchUpRequest(
      client,
      activityId((await context.params).id),
      catchUpReviewInput(await readActivityJson(request)),
    ),
  );
}
