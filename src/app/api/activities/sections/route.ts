import { activityRequest, readActivityJson } from '@/auth/activity-http';
import { sectionActivityInput } from '@/core/activity-input';
import { createSectionActivity } from '@/data/activities';

export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  return activityRequest(
    request,
    true,
    async (client) =>
      createSectionActivity(
        client,
        sectionActivityInput(await readActivityJson(request)),
      ),
    201,
  );
}
