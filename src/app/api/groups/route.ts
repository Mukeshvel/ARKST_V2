import { activityRequest, readActivityJson } from '@/auth/activity-http';
import {
  activityId,
  groupDetailsInput,
  ActivityError,
} from '@/core/activity-input';
import { departmentRpc } from '@/data/department-operations';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return activityRequest(request, false, async (client) => {
    const query = new URL(request.url).searchParams;
    if (
      [...query.keys()].some((key) => key !== 'department') ||
      query.getAll('department').length !== 1
    )
      throw new ActivityError(400, 'Expected one department.');
    return {
      groups: await departmentRpc(client, 'list_academic_groups', {
        p_department: activityId(query.get('department')),
      }),
    };
  });
}
export async function POST(request: Request) {
  return activityRequest(
    request,
    true,
    async (client) => ({
      id: await departmentRpc(
        client,
        'create_academic_group',
        groupDetailsInput(await readActivityJson(request)),
      ),
    }),
    201,
  );
}
