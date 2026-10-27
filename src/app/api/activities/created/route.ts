import { activityRequest } from '@/auth/activity-http';
import { activityOffset } from '@/core/activity-input';
import { listCreatedActivities } from '@/data/activities';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return activityRequest(request, false, (client, identity) =>
    listCreatedActivities(
      client,
      identity.profile.id,
      activityOffset(request.url),
    ),
  );
}
