import { activityRequest } from '@/auth/activity-http';
import { activityId, ActivityError } from '@/core/activity-input';

export const dynamic = 'force-dynamic';
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return activityRequest(request, false, async (client) => {
    const id = activityId((await context.params).id);
    const { data, error } = await client
      .from('notifications')
      .select('source_kind,source_id')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new ActivityError(503, 'Notification lookup failed.');
    if (!data) throw new ActivityError(404, 'Notification is unavailable.');
    return {
      title:
        data.source_kind === 'activity'
          ? 'New ARKST Activity'
          : 'New ARKST announcement',
      message: 'Open ARKST to view your update.',
      url:
        data.source_kind === 'activity'
          ? `/dashboard/student?activity=${data.source_id}`
          : `/dashboard/announcements/${data.source_id}`,
    };
  });
}
