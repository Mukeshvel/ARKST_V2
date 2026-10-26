import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { IdentityError } from '@/auth/errors';

export interface Profile {
  id: string;
  display_name: string;
  account_kind: 'student' | 'staff';
  staff_classification: 'teaching' | 'non_teaching' | null;
  is_active: boolean;
}
export interface Responsibility {
  id: string;
  user_id: string;
  role: string;
  scope_id: string;
  starts_at: string;
  ends_at: string | null;
}

/** The ID comes exclusively from verified Supabase Auth, never from a request. */
export async function loadOwnIdentity(client: SupabaseClient, userId: string) {
  const { data: profile, error } = await client
    .from('profiles')
    .select('id, display_name, account_kind, staff_classification, is_active')
    .eq('id', userId)
    .maybeSingle<Profile>();
  if (error)
    throw new IdentityError(
      503,
      'Profile database is unavailable. Please try again.',
    );
  if (!profile || !profile.is_active)
    throw new IdentityError(
      403,
      'Your account is not provisioned or is inactive. Contact an administrator.',
    );
  const { data: responsibilities, error: rolesError } = await client
    .from('responsibility_assignments')
    .select('id, user_id, role, scope_id, starts_at, ends_at')
    .eq('user_id', userId)
    .order('role')
    .returns<Responsibility[]>();
  if (rolesError)
    throw new IdentityError(
      503,
      'Responsibility database is unavailable. Please try again.',
    );
  if (!Array.isArray(responsibilities))
    throw new IdentityError(
      503,
      'Responsibility database returned an invalid response.',
    );
  return { profile, responsibilities };
}
