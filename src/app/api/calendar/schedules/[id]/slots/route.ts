import { activityRequest, readActivityJson } from '@/auth/activity-http';
import { activityId } from '@/core/activity-input';
import { slotInput } from '@/core/calendar-input';
import { departmentRpc } from '@/data/department-operations';

export const dynamic = 'force-dynamic';
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return activityRequest(request, true, async (client) => ({
    id: await departmentRpc(client, 'configure_recurring_slot', {
      p_schedule: activityId((await context.params).id),
      ...slotInput(await readActivityJson(request)),
    }),
  }));
}
