import { activityRequest, readActivityJson } from '@/auth/activity-http';
import { scheduleCreateInput } from '@/core/calendar-input';
import { departmentRpc } from '@/data/department-operations';

export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  return activityRequest(
    request,
    true,
    async (client) => ({
      id: await departmentRpc(
        client,
        'create_recurring_schedule',
        scheduleCreateInput(await readActivityJson(request)),
      ),
    }),
    201,
  );
}
