import { activityRequest, readActivityJson } from '@/auth/activity-http';
import { activityId } from '@/core/activity-input';
import { decisionInput } from '@/core/calendar-input';
import { departmentRpc } from '@/data/department-operations';

export const dynamic = 'force-dynamic';
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return activityRequest(request, true, async (client) =>
    departmentRpc(client, 'decide_blocked_recurring_instance', {
      p_instance: activityId((await context.params).id),
      ...decisionInput(await readActivityJson(request)),
    }),
  );
}
