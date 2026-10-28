import { NextResponse } from 'next/server';
import { createIdentityClient, identityConfig } from '@/auth/server';
import { googleAuthorizationUrl } from '@/auth/google-oauth';
import { IdentityError, publicIdentityError } from '@/auth/errors';
import { privateHeaders, requireSameOrigin } from '@/auth/http';

export async function POST(request: Request) {
  try {
    const config = identityConfig();
    requireSameOrigin(request, config.appOrigin);
    if (!config.googleOAuthEnabled)
      throw new IdentityError(403, 'Google sign-in is not configured.');
    const callback = `${config.appOrigin}/auth/google/callback`;
    const client = await createIdentityClient(true);
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callback, skipBrowserRedirect: true },
    });
    if (error) throw new IdentityError(503, 'Google sign-in is unavailable.');
    const url = googleAuthorizationUrl(data.url, config.url, callback);
    return NextResponse.redirect(url, { status: 303, headers: privateHeaders });
  } catch (error) {
    const failure = publicIdentityError(error);
    return NextResponse.json(
      { error: failure.message },
      { status: failure.status, headers: privateHeaders },
    );
  }
}
