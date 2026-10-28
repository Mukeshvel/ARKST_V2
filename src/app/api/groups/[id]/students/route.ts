import { activityRequest } from '@/auth/activity-http';
import { activityId, groupStudentQuery } from '@/core/activity-input';
import { departmentRpc } from '@/data/department-operations';

export const dynamic = 'force-dynamic';
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return activityRequest(request, false, async (client) =>
    departmentRpc(client, 'group_eligible_students', {
      p_group: activityId((await context.params).id),
      ...groupStudentQuery(request.url),
    }),
  );
}
