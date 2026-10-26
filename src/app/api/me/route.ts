import { NextResponse } from 'next/server';
import { requireOwnIdentity } from '@/auth/identity';
import { publicIdentityError } from '@/auth/errors';
import { privateHeaders } from '@/auth/http';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    return NextResponse.json(await requireOwnIdentity(true), {
      headers: privateHeaders,
    });
  } catch (error) {
    const failure = publicIdentityError(error);
    return NextResponse.json(
      { error: failure.message },
      { status: failure.status, headers: privateHeaders },
    );
  }
}
