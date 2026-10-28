import { activityRequest, readActivityJson } from '@/auth/activity-http';
import { activityId } from '@/core/activity-input';
import { scheduleConfigureInput } from '@/core/calendar-input';
import { departmentRpc } from '@/data/department-operations';

export const dynamic = 'force-dynamic';
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return activityRequest(request, true, async (client) =>
    departmentRpc(client, 'configure_recurring_schedule', {
      p_schedule: activityId((await context.params).id),
      ...scheduleConfigureInput(await readActivityJson(request)),
    }),
  );
}
