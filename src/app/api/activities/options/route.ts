import { activityRequest } from '@/auth/activity-http';
import { activityCreationOptions } from '@/data/activities';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return activityRequest(request, false, activityCreationOptions);
}
