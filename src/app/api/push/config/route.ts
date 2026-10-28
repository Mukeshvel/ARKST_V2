import { activityRequest } from '@/auth/activity-http';
import { ActivityError } from '@/core/activity-input';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return activityRequest(request, false, async () => {
    const publicKey = process.env.PUSH_VAPID_PUBLIC_KEY;
    if (!publicKey || !/^[A-Za-z0-9_-]{60,120}$/.test(publicKey))
      throw new ActivityError(503, 'Desktop notifications are not configured.');
    return { publicKey };
  });
}
