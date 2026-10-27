import { activityRequest, readActivityJson } from '@/auth/activity-http';
import { selectedActivityInput } from '@/core/activity-input';
import { createSelectedActivity } from '@/data/activities';

export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  return activityRequest(
    request,
    true,
    async (client) =>
      createSelectedActivity(
        client,
        selectedActivityInput(await readActivityJson(request)),
      ),
    201,
  );
}
