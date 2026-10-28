import { activityRequest } from '@/auth/activity-http';
import { notificationOffset } from '@/core/activity-input';
import { attentionNeeded } from '@/data/activities';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return activityRequest(request, false, (client) =>
    attentionNeeded(client, notificationOffset(request.url)),
  );
}
