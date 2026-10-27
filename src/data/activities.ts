import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ActivityError, activityInput } from '@/core/activity-input';

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
