import { activityRequest, readActivityJson } from '@/auth/activity-http';
import { followUpInput, followUpSelection } from '@/core/activity-input';
import { listFollowUps, sendFollowUps } from '@/data/activities';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return activityRequest(request, false, (client) =>
    listFollowUps(client, followUpSelection(request.url)),
  );
}
export async function POST(request: Request) {
  return activityRequest(
    request,
    true,
    async (client) =>
      sendFollowUps(client, followUpInput(await readActivityJson(request))),
    201,
  );
}
