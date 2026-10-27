import { activityRequest, readActivityJson } from '@/auth/activity-http';
import { announcementInput } from '@/core/activity-input';
import { publishAnnouncement } from '@/data/activities';

export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  return activityRequest(
    request,
    true,
    async (client) =>
      publishAnnouncement(
        client,
        announcementInput(await readActivityJson(request)),
      ),
    201,
  );
}
