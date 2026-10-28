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
      .select('source_kind,source_id,target_path')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new ActivityError(503, 'Notification lookup failed.');
    if (!data) throw new ActivityError(404, 'Notification is unavailable.');
    return {
      title:
        data.source_kind === 'activity'
          ? 'New ARKST Activity'
          : data.source_kind === 'announcement'
            ? 'New ARKST announcement'
            : 'New ARKST update',
      message: 'Open ARKST to view your update.',
      url:
        data.target_path &&
        /^\/dashboard\/(student\?activity=[0-9a-f-]{36}|announcements\/[0-9a-f-]{36}|notifications|attention)$/i.test(
          data.target_path,
        )
          ? data.target_path
          : data.source_kind === 'activity'
            ? `/dashboard/student?activity=${data.source_id}`
            : data.source_kind === 'announcement'
              ? `/dashboard/announcements/${data.source_id}`
              : '/dashboard/notifications',
    };
  });
}
