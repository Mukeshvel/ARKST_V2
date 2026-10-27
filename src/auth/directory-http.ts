import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireOwnIdentity } from './identity';
import { createIdentityClient, identityConfig } from './server';
import { privateHeaders, requireSameOrigin } from './http';
import { publicIdentityError } from './errors';
import { DirectoryError } from '@/core/staff-directory-input';

export async function directoryRequest(
  request: Request,
  mutation: boolean,
  action: (client: SupabaseClient) => Promise<unknown>,
) {
  try {
    if (mutation) requireSameOrigin(request, identityConfig().appOrigin);
    await requireOwnIdentity(true);
    return NextResponse.json(await action(await createIdentityClient(true)), {
      headers: privateHeaders,
    });
  } catch (error) {
    const e =
      error instanceof DirectoryError ? error : publicIdentityError(error);
    return NextResponse.json(
      { error: e.message },
      { status: e.status, headers: privateHeaders },
    );
  }
}

export async function directoryBody(request: Request): Promise<unknown> {
  if (
    request.headers.get('content-type')?.split(';')[0]?.trim() !==
    'application/json'
  )
    throw new DirectoryError(415, 'Expected application/json.');
  const reader = request.body?.getReader();
  if (!reader) throw new DirectoryError(400, 'JSON body required.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 16384) {
        await reader.cancel();
        throw new DirectoryError(413, 'Request too large.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new DirectoryError(400, 'Malformed JSON.');
  }
}
