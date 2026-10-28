import { NextResponse } from 'next/server';
import {
  createIdentityClient,
  clearApplicationSession,
  identityConfig,
} from '@/auth/server';
import { googleCallbackCode } from '@/auth/google-oauth';
import { loadOwnIdentity } from '@/data/identity';
import { privateHeaders } from '@/auth/http';

export async function GET(request: Request) {
  let config;
  try {
    config = identityConfig();
  } catch {
    return NextResponse.json(
      { error: 'Identity is not configured.' },
      { status: 503, headers: privateHeaders },
    );
  }
  let reason: 'access' | 'service' = 'service';
  try {
    if (!config.googleOAuthEnabled)
      throw new Error('Google OAuth is disabled.');
    const code = googleCallbackCode(request.url, config.appOrigin);
    const client = await createIdentityClient(true);
    const exchange = await client.auth.exchangeCodeForSession(code);
    if (exchange.error || !exchange.data.user || !exchange.data.session)
      throw new Error('Google code exchange failed.');
    const user = await client.auth.getUser();
    if (
      user.error ||
      !user.data.user ||
      user.data.user.id !== exchange.data.user.id ||
      !user.data.user.email_confirmed_at
    )
      throw new Error('Google user verification failed.');
    try {
      await loadOwnIdentity(client, user.data.user.id);
    } catch (error) {
      if (error instanceof Error && 'status' in error && error.status === 403)
        reason = 'access';
      throw error;
    }
    return NextResponse.redirect(new URL('/profile', config.appOrigin), {
      status: 303,
      headers: privateHeaders,
    });
  } catch {
    // A successful provider login without an approved profile must not retain an app session.
    try {
      const client = await createIdentityClient(true);
      await client.auth.signOut({ scope: 'local' });
    } catch {
      /* local cookies are cleared below */
    }
    await clearApplicationSession();
    return NextResponse.redirect(
      new URL(`/login?error=${reason}`, config.appOrigin),
      { status: 303, headers: privateHeaders },
    );
  }
}
