import { activityRequest, readActivityJson } from '@/auth/activity-http';
import { catchUpRequestInput, notificationOffset } from '@/core/activity-input';
import { listCatchUpRequests, submitCatchUpRequest } from '@/data/activities';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return activityRequest(request, false, (client) =>
    listCatchUpRequests(client, notificationOffset(request.url)),
  );
}
export async function POST(request: Request) {
  return activityRequest(
    request,
    true,
    async (client) =>
      submitCatchUpRequest(
        client,
        catchUpRequestInput(await readActivityJson(request)),
      ),
    201,
  );
}
