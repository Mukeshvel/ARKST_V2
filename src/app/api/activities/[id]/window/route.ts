import { activityRequest, readActivityJson } from '@/auth/activity-http';
import { activityId } from '@/core/activity-input';
import { windowInput } from '@/core/calendar-input';
import { departmentRpc } from '@/data/department-operations';

export const dynamic = 'force-dynamic';
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return activityRequest(request, true, async (client) =>
    departmentRpc(client, 'change_activity_window', {
      p_activity: activityId((await context.params).id),
      ...windowInput(await readActivityJson(request)),
    }),
  );
}
