import { activityRequest } from '@/auth/activity-http';
import { notificationOffset } from '@/core/activity-input';
import { missedInformationAttention } from '@/data/activities';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return activityRequest(request, false, (client) =>
    missedInformationAttention(client, notificationOffset(request.url)),
  );
}
