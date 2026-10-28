import { activityRequest, readActivityJson } from '@/auth/activity-http';
import { activityId, groupMemberInput } from '@/core/activity-input';
import { departmentRpc } from '@/data/department-operations';

export const dynamic = 'force-dynamic';
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return activityRequest(request, true, async (client) =>
    departmentRpc(client, 'change_group_membership', {
      p_group: activityId((await context.params).id),
      ...groupMemberInput(await readActivityJson(request)),
    }),
  );
}
