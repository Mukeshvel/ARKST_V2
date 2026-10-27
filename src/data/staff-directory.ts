import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DirectoryError,
  staffDirectoryInput,
} from '@/core/staff-directory-input';

function unwrap<T>(result: { data: T; error: { code?: string } | null }): T {
  if (result.error) {
    if (result.error.code === '42501')
      throw new DirectoryError(
        403,
        'Department staff access is not permitted.',
      );
    if (['22023', '22P02', '23514'].includes(result.error.code ?? ''))
      throw new DirectoryError(400, 'Invalid directory update.');
    console.error(
      'Staff directory database operation failed; code:',
      result.error.code ?? 'unavailable',
    );
    throw new DirectoryError(503, 'Staff directory database is unavailable.');
  }
  return result.data;
}

export async function loadStaffDirectory(client: SupabaseClient) {
  const identity = unwrap(
    await client.from('profiles').select('staff_classification').single(),
  ) as { staff_classification: string };
  const sections = unwrap(await client.rpc('staff_available_sections')) as {
    id: string;
    name: string;
  }[];
  const profile = unwrap(
    await client
      .from('staff_directory_profiles')
      .select('teaching_status,designation,subjects,updated_at')
      .maybeSingle(),
  );
  const preferences = unwrap(
    await client
      .from('staff_section_preferences')
      .select('section_scope_id')
      .order('section_scope_id'),
  ) as { section_scope_id: string }[];
  return {
    profile,
    subjects: profile?.subjects ?? [],
    teachingStatus: profile?.teaching_status ?? identity.staff_classification,
    designation: profile?.designation ?? '',
    sections,
    sectionIds: preferences.map((x) => x.section_scope_id),
  };
}

export async function updateStaffDirectory(
  client: SupabaseClient,
  value: unknown,
) {
  const input = staffDirectoryInput(value);
  unwrap(await client.rpc('update_staff_directory_profile', input));
  return loadStaffDirectory(client);
}

export async function listCounselorStudents(
  client: SupabaseClient,
  offset = 0,
) {
  const response = await client
    .from('counselor_student_mappings')
    .select(
      'id,starts_at,ends_at,student:department_student_roster(id,external_student_id,display_name,section_scope_id,active)',
      { count: 'exact' },
    )
    .lte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: false })
    .order('id')
    .range(offset, offset + 49);
  const rows = unwrap(response);
  if (response.count === null)
    throw new DirectoryError(503, 'Counselor student count is unavailable.');
  return { students: rows, total: response.count, offset, pageSize: 50 };
}
