import { NextResponse } from 'next/server';
import { createIdentityClient, identityConfig } from '@/auth/server';
import {
  authenticationError,
  IdentityError,
  publicIdentityError,
} from '@/auth/errors';
import {
  privateHeaders,
  readCredentials,
  requireSameOrigin,
} from '@/auth/http';

export async function POST(request: Request) {
  try {
    const config = identityConfig();
    requireSameOrigin(request, config.appOrigin);
    if (!config.local)
      throw new IdentityError(
        403,
        'Password login is enabled only for isolated local development.',
      );
    const credentials = await readCredentials(request);
    const client = await createIdentityClient(true);
    const { data, error } = await client.auth.signInWithPassword(credentials);
    if (error) throw authenticationError(error);
    if (!data.user || !data.session)
      throw new IdentityError(401, 'Sign-in failed.');
    return NextResponse.redirect(new URL('/profile', config.appOrigin), {
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
