import { activityRequest, readActivityJson } from '@/auth/activity-http';
import { activityId, followUpResolutionInput } from '@/core/activity-input';
import { resolveFollowUp } from '@/data/activities';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return activityRequest(request, true, async (client) => {
    const id = activityId((await context.params).id);
    const { p_note } = followUpResolutionInput(await readActivityJson(request));
    return resolveFollowUp(client, id, p_note);
  });
}
