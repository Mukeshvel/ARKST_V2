import { directoryRequest } from '@/auth/directory-http';
import { directoryOffset } from '@/core/staff-directory-input';
import { listCounselorStudents } from '@/data/staff-directory';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return directoryRequest(request, false, (client) =>
    listCounselorStudents(client, directoryOffset(request.url)),
  );
}
