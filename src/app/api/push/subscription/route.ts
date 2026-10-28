import { activityRequest, readActivityJson } from '@/auth/activity-http';
import { pushEndpointInput, pushSubscriptionInput } from '@/core/push-input';
import {
  disablePushSubscription,
  registerPushSubscription,
  pushSubscriptionStatus,
} from '@/data/push';

export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  return activityRequest(request, true, async (client) =>
    registerPushSubscription(
      client,
      pushSubscriptionInput(await readActivityJson(request)),
    ),
  );
}
export async function PUT(request: Request) {
  return activityRequest(request, true, async (client) =>
    pushSubscriptionStatus(
      client,
      pushEndpointInput(await readActivityJson(request)),
    ),
  );
}
export async function DELETE(request: Request) {
  return activityRequest(request, true, async (client) =>
    disablePushSubscription(
      client,
      pushEndpointInput(await readActivityJson(request)),
    ),
  );
}
