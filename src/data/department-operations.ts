import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ActivityError } from '@/core/activity-input';

export async function departmentRpc<T = unknown>(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    if (error.code === '42501')
      throw new ActivityError(
        403,
        'This department operation or target is not permitted.',
      );
    if (error.code === '23505')
      throw new ActivityError(
        409,
        'This record already exists or has already changed.',
      );
    if (['22023', '22P02', '23514', '23503'].includes(error.code ?? ''))
      throw new ActivityError(
        400,
        'Invalid department operation or relationship.',
      );
    console.error(
      'Department database operation failed; code:',
      error.code ?? 'unavailable',
    );
    throw new ActivityError(
      503,
      'Department database operation failed. Reload before retrying.',
    );
  }
  return data as T;
}
