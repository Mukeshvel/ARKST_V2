import { activityRequest, readActivityJson } from '@/auth/activity-http';
import { activityId, announcementInput } from '@/core/activity-input';
import { publishCatchUpRequest } from '@/data/activities';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return activityRequest(request, true, async (client) =>
    publishCatchUpRequest(
      client,
      activityId((await context.params).id),
      announcementInput(await readActivityJson(request)),
    ),
  );
}
