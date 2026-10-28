import { activityRequest, readActivityJson } from '@/auth/activity-http';
import { escalationInput, notificationOffset } from '@/core/activity-input';
import { escalateActivity, listEscalations } from '@/data/activities';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return activityRequest(request, false, (client) =>
    listEscalations(client, notificationOffset(request.url)),
  );
}
export async function POST(request: Request) {
  return activityRequest(
    request,
    true,
    async (client) =>
      escalateActivity(
        client,
        escalationInput(await readActivityJson(request)),
      ),
    201,
  );
}
