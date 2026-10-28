import { activityRequest } from '@/auth/activity-http';
import { departmentQuery } from '@/core/calendar-input';
import { departmentRpc } from '@/data/department-operations';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return activityRequest(request, false, (client) =>
    departmentRpc(client, 'calendar_overview', {
      p_department: departmentQuery(request.url),
    }),
  );
}
