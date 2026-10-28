import { activityRequest, readActivityJson } from '@/auth/activity-http';
import { activityId } from '@/core/activity-input';
import { pausedInput } from '@/core/calendar-input';
import { departmentRpc } from '@/data/department-operations';

export const dynamic = 'force-dynamic';
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return activityRequest(request, true, async (client) =>
    departmentRpc(client, 'set_recurring_schedule_paused', {
      p_schedule: activityId((await context.params).id),
      ...pausedInput(await readActivityJson(request)),
    }),
  );
}
