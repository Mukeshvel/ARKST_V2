import { NextResponse } from 'next/server';
import {
  clearApplicationSession,
  createIdentityClient,
  identityConfig,
} from '@/auth/server';
import { IdentityError, publicIdentityError } from '@/auth/errors';
import { privateHeaders, requireSameOrigin } from '@/auth/http';

export async function POST(request: Request) {
  try {
    const config = identityConfig();
    requireSameOrigin(request, config.appOrigin);
    try {
      const client = await createIdentityClient(true);
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch {
      throw new IdentityError(
        503,
        'Local session cleared, but server logout could not be confirmed. Previously issued tokens may remain valid until expiry.',
      );
    } finally {
      await clearApplicationSession();
    }
    return NextResponse.redirect(new URL('/login', config.appOrigin), {
      status: 303,
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
