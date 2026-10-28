import { activityRequest } from '@/auth/activity-http';
import { departmentRpc } from '@/data/department-operations';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return activityRequest(request, false, async (client) => ({
    departments: await departmentRpc(client, 'department_operation_options'),
  }));
}
