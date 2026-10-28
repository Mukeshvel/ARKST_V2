import { activityRequest, readActivityJson } from '@/auth/activity-http';
import { activityId } from '@/core/activity-input';
import { activeInput } from '@/core/calendar-input';
import { departmentRpc } from '@/data/department-operations';

export const dynamic = 'force-dynamic';
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return activityRequest(request, true, async (client) =>
    departmentRpc(client, 'set_academic_blackout_active', {
      p_blackout: activityId((await context.params).id),
      ...activeInput(await readActivityJson(request)),
    }),
  );
}
