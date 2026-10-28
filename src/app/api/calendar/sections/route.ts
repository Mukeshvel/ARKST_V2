import { activityRequest } from '@/auth/activity-http';
import { departmentQuery } from '@/core/calendar-input';
import { departmentRpc } from '@/data/department-operations';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return activityRequest(request, false, async (client) => ({
    sections: await departmentRpc(client, 'calendar_available_sections', {
      p_department: departmentQuery(request.url),
    }),
  }));
}
