import { activityRequest } from '@/auth/activity-http';
import { activityId, notificationOffset } from '@/core/activity-input';
import { departmentRpc } from '@/data/department-operations';

export const dynamic = 'force-dynamic';
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return activityRequest(request, false, async (client) =>
    departmentRpc(client, 'group_membership_history', {
      p_group: activityId((await context.params).id),
      p_offset: notificationOffset(request.url),
    }),
  );
}
