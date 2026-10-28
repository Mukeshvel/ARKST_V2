import { activityRequest, readActivityJson } from '@/auth/activity-http';
import { blackoutInput } from '@/core/calendar-input';
import { departmentRpc } from '@/data/department-operations';

export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  return activityRequest(
    request,
    true,
    async (client) => ({
      id: await departmentRpc(
        client,
        'create_academic_blackout',
        blackoutInput(await readActivityJson(request)),
      ),
    }),
    201,
  );
}
