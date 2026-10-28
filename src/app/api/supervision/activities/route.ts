import { activityRequest } from '@/auth/activity-http';
import { supervisionActivityQuery } from '@/core/calendar-input';
import { departmentRpc } from '@/data/department-operations';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return activityRequest(request, false, (client) =>
    departmentRpc(
      client,
      'supervisory_activity_overview',
      supervisionActivityQuery(request.url),
    ),
  );
}
