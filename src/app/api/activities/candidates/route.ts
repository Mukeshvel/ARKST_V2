import { activityRequest } from '@/auth/activity-http';
import { candidateInput } from '@/core/activity-input';
import { eligibleActivityStudents } from '@/data/activities';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return activityRequest(request, false, (client) =>
    eligibleActivityStudents(client, candidateInput(request.url)),
  );
}
