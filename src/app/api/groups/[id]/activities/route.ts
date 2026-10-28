import { activityRequest, readActivityJson } from '@/auth/activity-http';
import { activityId, groupActivityInput } from '@/core/activity-input';
import { departmentRpc } from '@/data/department-operations';

export const dynamic = 'force-dynamic';
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return activityRequest(
    request,
    true,
    async (client) =>
      departmentRpc(client, 'publish_group_activity', {
        p_group: activityId((await context.params).id),
        ...groupActivityInput(await readActivityJson(request)),
      }),
    201,
  );
}
