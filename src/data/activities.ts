import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ActivityError,
  activityInput,
  announcementInput,
  candidateInput,
  sectionActivityInput,
  selectedActivityInput,
} from '@/core/activity-input';

function result<T>({
  data,
  error,
}: {
  data: T;
  error: { code?: string } | null;
}): T {
  if (error) {
    const code = error.code;
    if (code === '42501')
      throw new ActivityError(
        403,
        'This activity operation or target is not permitted.',
      );
    if (code === '23505')
      throw new ActivityError(
        409,
        'This completion already exists or the transition is not allowed.',
      );
    if (code === '22023' || code === '22P02' || code === '23514')
      throw new ActivityError(
        400,
        'Invalid activity data or closed submission window.',
      );
    console.error(
      'Activity database operation failed; code:',
      code ?? 'unavailable',
    );
    throw new ActivityError(
      503,
      'Activity database is unavailable. No success is confirmed; reload before retrying.',
    );
  }
  return data;
}

const selection =
  '*, assignments:activity_assignments(id, student_id, assigned_at, completion:activity_completions(*))';

export async function listActivities(client: SupabaseClient, offset: number) {
  const activities = result(
    await client
      .from('activities')
      .select(selection)
      .order('created_at', { ascending: false })
      .order('id')
      .range(offset, offset + 49),
  );
  return { activities, offset, pageSize: 50 };
}

const summarySelection =
  'id,title,description,category_key,scope_id,starts_at,deadline_at,ends_at,requires_verification,created_at,created_by';

export async function listCreatedActivities(
  client: SupabaseClient,
  creatorId: string,
  offset: number,
) {
  const response = await client
    .from('activities')
    .select(summarySelection, { count: 'exact' })
    .eq('created_by', creatorId)
    .order('created_at', { ascending: false })
    .order('id')
    .range(offset, offset + 49);
  const activities = result(response);
  if (response.count === null)
    throw new ActivityError(503, 'Activity count is unavailable.');
  return { activities, total: response.count, offset, pageSize: 50 };
}

export async function getActivitySummary(client: SupabaseClient, id: string) {
  const activity = result(
    await client
      .from('activities')
      .select(summarySelection)
      .eq('id', id)
      .maybeSingle(),
  );
  if (!activity) throw new ActivityError(404, 'Activity is unavailable.');
  return { activity };
}

export async function getActivity(client: SupabaseClient, id: string) {
  const activity = result(
    await client
      .from('activities')
      .select(selection)
      .eq('id', id)
      .maybeSingle(),
  );
  if (!activity) throw new ActivityError(404, 'Activity is unavailable.');
  // Events are paginated separately, so roster size cannot silently truncate history.
  return { activity };
}

export async function activityHistory(
  client: SupabaseClient,
  id: string,
  offset: number,
) {
  await getActivity(client, id);
  const history = result(
    await client
      .from('activity_history')
      .select('*')
      .eq('activity_id', id)
      .order('id')
      .range(offset, offset + 49),
  );
  return { history, offset, pageSize: 50 };
}

export async function createActivity(
  client: SupabaseClient,
  input: ReturnType<typeof activityInput>,
) {
  const id = result(await client.rpc('create_activity', input));
  if (typeof id !== 'string')
    throw new ActivityError(
      503,
      'Creation result is unavailable. Reload before retrying.',
    );
  return { id };
}

export async function createSectionActivity(
  client: SupabaseClient,
  input: ReturnType<typeof sectionActivityInput>,
) {
  const created = result(await client.rpc('create_section_activity', input));
  if (
    !created ||
    typeof created !== 'object' ||
    typeof (created as { id?: unknown }).id !== 'string' ||
    typeof (created as { assignedCount?: unknown }).assignedCount !== 'number'
  )
    throw new ActivityError(
      503,
      'Creation result is unavailable. Reload before retrying.',
    );
  return created;
}

export async function monitorCreatedActivity(
  client: SupabaseClient,
  id: string,
  offset: number,
) {
  return result(
    await client.rpc('monitor_created_activity', {
      p_activity: id,
      p_offset: offset,
    }),
  );
}

export async function monitorCounselorActivities(
  client: SupabaseClient,
  offset: number,
) {
  return result(
    await client.rpc('monitor_counselor_activities', { p_offset: offset }),
  );
}

export async function activityCreationOptions(client: SupabaseClient) {
  const options = result(await client.rpc('activity_creation_options'));
  if (!Array.isArray(options))
    throw new ActivityError(503, 'Activity creation options are unavailable.');
  return { options };
}

export async function changeCompletion(
  client: SupabaseClient,
  id: string,
  verify: boolean,
) {
  const completion = result(
    await client.rpc(verify ? 'verify_activity' : 'submit_activity', {
      p_assignment: id,
    }),
  );
  if (!completion)
    throw new ActivityError(
      503,
      'Completion result is unavailable. Reload before retrying.',
    );
  return { completion };
}

export async function eligibleActivityStudents(
  client: SupabaseClient,
  input: ReturnType<typeof candidateInput>,
) {
  return result(await client.rpc('eligible_activity_students', input));
}

export async function createSelectedActivity(
  client: SupabaseClient,
  input: ReturnType<typeof selectedActivityInput>,
) {
  const created = result(await client.rpc('create_selected_activity', input));
  if (
    !created ||
    typeof created !== 'object' ||
    typeof (created as { id?: unknown }).id !== 'string' ||
    typeof (created as { assignedCount?: unknown }).assignedCount !== 'number'
  )
    throw new ActivityError(
      503,
      'Publication result is unavailable. Reload before retrying.',
    );
  return created;
}

export async function monitorCounselorActivity(
  client: SupabaseClient,
  id: string,
  offset: number,
) {
  return result(
    await client.rpc('monitor_counselor_activity', {
      p_activity: id,
      p_offset: offset,
    }),
  );
}

export async function counselorActivitySummaries(
  client: SupabaseClient,
  offset: number,
) {
  return result(
    await client.rpc('counselor_activity_summaries', { p_offset: offset }),
  );
}

export async function pendingStudentsText(
  client: SupabaseClient,
  id: string,
  counselorView: boolean,
) {
  const pending = result(
    await client.rpc('pending_students_text', {
      p_activity: id,
      p_counselor_view: counselorView,
    }),
  );
  if (
    !pending ||
    typeof pending !== 'object' ||
    typeof (pending as { text?: unknown }).text !== 'string' ||
    typeof (pending as { count?: unknown }).count !== 'number'
  )
    throw new ActivityError(
      503,
      'Pending list is unavailable. Nothing was copied.',
    );
  return pending;
}

export async function publishAnnouncement(
  client: SupabaseClient,
  input: ReturnType<typeof announcementInput>,
) {
  const published = result(await client.rpc('publish_announcement', input));
  if (
    !published ||
    typeof published !== 'object' ||
    typeof (published as { id?: unknown }).id !== 'string' ||
    typeof (published as { recipientCount?: unknown }).recipientCount !==
      'number'
  )
    throw new ActivityError(
      503,
      'Announcement result is unavailable. Reload before retrying.',
    );
  return published;
}

export async function getAnnouncement(client: SupabaseClient, id: string) {
  const announcement = result(
    await client
      .from('announcements')
      .select('id,title,message,created_at,created_by')
      .eq('id', id)
      .maybeSingle(),
  );
  if (!announcement)
    throw new ActivityError(404, 'Announcement is unavailable.');
  return { announcement };
}

export async function listNotifications(
  client: SupabaseClient,
  offset: number,
) {
  const response = await client
    .from('notifications')
    .select(
      'id,source_kind,source_id,title,message,target_path,created_at,read_at',
      {
        count: 'exact',
      },
    )
    .order('created_at', { ascending: false })
    .order('id')
    .range(offset, offset + 49);
  const notifications = result(response);
  if (response.count === null)
    throw new ActivityError(503, 'Notification count is unavailable.');
  const unreadResponse = await client
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  result(unreadResponse);
  if (unreadResponse.count === null)
    throw new ActivityError(503, 'Unread count is unavailable.');
  return {
    notifications,
    total: response.count,
    unread: unreadResponse.count,
    offset,
    pageSize: 50,
  };
}

export async function listFollowUps(
  client: SupabaseClient,
  assignments: string[],
) {
  if (!assignments.length) return { followUps: [], total: 0, truncated: false };
  const response = await client
    .from('activity_follow_ups')
    .select(
      'id,assignment_id,recipient_id,initiated_by,reason,status,created_at,resolved_at,resolution,resolution_note,activity_follow_up_history(actor_id,action,occurred_at,note)',
      { count: 'exact' },
    )
    .in('assignment_id', assignments)
    .order('created_at', { ascending: false })
    .range(0, 499);
  const followUps = result(response);
  if (response.count === null)
    throw new ActivityError(503, 'Follow-up count is unavailable.');
  return { followUps, total: response.count, truncated: response.count > 500 };
}

export async function sendFollowUps(
  client: SupabaseClient,
  input: { p_assignments: string[]; p_reason: string },
) {
  return result(await client.rpc('send_activity_follow_ups', input));
}

export async function resolveFollowUp(
  client: SupabaseClient,
  id: string,
  note: string,
) {
  return result(
    await client.rpc('resolve_activity_follow_up', {
      p_follow_up: id,
      p_note: note,
    }),
  );
}

export async function listCatchUpRequests(
  client: SupabaseClient,
  offset: number,
) {
  return result(
    await client.rpc('list_catch_up_requests', { p_offset: offset }),
  );
}
export async function submitCatchUpRequest(
  client: SupabaseClient,
  input: { p_subject: string; p_information: string },
) {
  return { id: result(await client.rpc('submit_catch_up_request', input)) };
}
export async function reviewCatchUpRequest(
  client: SupabaseClient,
  id: string,
  input: { p_approve: boolean; p_reason: string | null },
) {
  return result(
    await client.rpc('review_catch_up_request', { p_request: id, ...input }),
  );
}
export async function publishCatchUpRequest(
  client: SupabaseClient,
  id: string,
  input: ReturnType<typeof announcementInput>,
) {
  return result(
    await client.rpc('publish_catch_up_request', { p_request: id, ...input }),
  );
}

export async function attentionNeeded(client: SupabaseClient, offset: number) {
  return result(await client.rpc('attention_needed', { p_offset: offset }));
}
export async function missedInformationAttention(
  client: SupabaseClient,
  offset: number,
) {
  return result(
    await client.rpc('missed_information_attention', { p_offset: offset }),
  );
}
export async function listEscalations(client: SupabaseClient, offset: number) {
  return result(
    await client.rpc('list_activity_escalations', { p_offset: offset }),
  );
}
export async function escalateActivity(
  client: SupabaseClient,
  input: { p_assignment: string; p_reason: string },
) {
  return result(await client.rpc('escalate_activity', input));
}
export async function resolveEscalation(
  client: SupabaseClient,
  id: string,
  note: string,
) {
  return result(
    await client.rpc('resolve_activity_escalation', {
      p_escalation: id,
      p_note: note,
    }),
  );
}

export async function markNotificationRead(client: SupabaseClient, id: string) {
  return result(
    await client.rpc('mark_notification_read', { p_notification: id }),
  );
}
