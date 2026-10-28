import { activityRequest } from '@/auth/activity-http';
import { supervisionQuery } from '@/core/calendar-input';
import { departmentRpc } from '@/data/department-operations';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return activityRequest(request, false, (client) =>
    departmentRpc(
      client,
      'supervisory_overview',
      supervisionQuery(request.url),
    ),
  );
}
