import { directoryRequest } from '@/auth/directory-http';
import { listCounselorStudents } from '@/data/staff-directory';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return directoryRequest(request, false, listCounselorStudents);
}
