import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireOwnIdentity } from './identity';
import { createIdentityClient, identityConfig } from './server';
import { privateHeaders, requireSameOrigin } from './http';
import { publicIdentityError } from './errors';
import { ActivityError } from '@/core/activity-input';

export async function activityRequest(
  request: Request,
  mutation: boolean,
  action: (client: SupabaseClient) => Promise<unknown>,
  status = 200,
) {
  try {
    if (mutation) requireSameOrigin(request, identityConfig().appOrigin);
    await requireOwnIdentity(true);
    return NextResponse.json(await action(await createIdentityClient(true)), {
      status,
      headers: privateHeaders,
    });
  } catch (error) {
    const failure =
      error instanceof ActivityError ? error : publicIdentityError(error);
    return NextResponse.json(
      { error: failure.message },
      { status: failure.status, headers: privateHeaders },
    );
  }
}

export async function readActivityJson(request: Request): Promise<unknown> {
  if (
    request.headers.get('content-type')?.split(';')[0]?.trim() !==
    'application/json'
  )
    throw new ActivityError(415, 'Expected application/json.');
  const reader = request.body?.getReader();
  if (!reader) throw new ActivityError(400, 'A JSON object is required.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 65536) {
        await reader.cancel();
        throw new ActivityError(413, 'Activity request exceeds 64 KiB.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new ActivityError(400, 'Malformed JSON.');
  }
}

export async function requireEmptyActivityJson(request: Request) {
  const value = await readActivityJson(request);
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length
  )
    throw new ActivityError(
      400,
      'Only an empty JSON object is accepted; actor and state are server-controlled.',
    );
}
