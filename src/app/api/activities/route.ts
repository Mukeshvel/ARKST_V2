import { activityRequest, readActivityJson } from '@/auth/activity-http';
import { activityInput, activityOffset } from '@/core/activity-input';
import { createActivity, listActivities } from '@/data/activities';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return activityRequest(request, false, (client) =>
    listActivities(client, activityOffset(request.url)),
  );
}
export async function POST(request: Request) {
  return activityRequest(
    request,
    true,
    async (client) =>
      createActivity(client, activityInput(await readActivityJson(request))),
    201,
  );
}
