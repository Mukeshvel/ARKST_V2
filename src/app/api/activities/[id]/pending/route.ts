import { activityRequest } from '@/auth/activity-http';
import { activityId, pendingView } from '@/core/activity-input';
import { pendingStudentsText } from '@/data/activities';

export const dynamic = 'force-dynamic';
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return activityRequest(request, false, async (client) =>
    pendingStudentsText(
      client,
      activityId((await context.params).id),
      pendingView(request.url),
    ),
  );
}
