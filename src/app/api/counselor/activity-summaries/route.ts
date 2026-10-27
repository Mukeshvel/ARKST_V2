import { activityRequest } from '@/auth/activity-http';
import { activityOffset } from '@/core/activity-input';
import { counselorActivitySummaries } from '@/data/activities';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return activityRequest(request, false, (client) =>
    counselorActivitySummaries(client, activityOffset(request.url)),
  );
}
