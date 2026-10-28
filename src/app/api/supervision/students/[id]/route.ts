import { activityRequest } from '@/auth/activity-http';
import { activityId } from '@/core/activity-input';
import { supervisionStudentQuery } from '@/core/calendar-input';
import { departmentRpc } from '@/data/department-operations';

export const dynamic = 'force-dynamic';
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return activityRequest(request, false, async (client) =>
    departmentRpc(client, 'supervisory_student_detail', {
      p_student: activityId((await context.params).id),
      ...supervisionStudentQuery(request.url),
    }),
  );
}
