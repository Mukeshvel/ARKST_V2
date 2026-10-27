import { directoryBody, directoryRequest } from '@/auth/directory-http';
import { DirectoryError } from '@/core/staff-directory-input';
import {
  loadStaffDirectory,
  updateStaffDirectory,
} from '@/data/staff-directory';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return directoryRequest(request, false, loadStaffDirectory);
}
export async function POST(request: Request) {
  return directoryRequest(request, true, async (client) => {
    const value = await directoryBody(request);
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.keys(value).length !== 1 ||
      (value as Record<string, unknown>).profile === undefined
    )
      throw new DirectoryError(400, 'Expected a profile object.');
    return updateStaffDirectory(
      client,
      (value as { profile: unknown }).profile,
    );
  });
}
