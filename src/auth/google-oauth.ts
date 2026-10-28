import { IdentityError } from './errors';

/** Supabase returns this URL after creating a PKCE verifier in the server cookie store. */
export function googleAuthorizationUrl(
  value: string | null,
  supabaseOrigin: string,
  callback: string,
) {
  if (!value) throw new IdentityError(503, 'Google sign-in is unavailable.');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new IdentityError(503, 'Google sign-in is unavailable.');
  }
  if (
    url.origin !== supabaseOrigin ||
    url.pathname !== '/auth/v1/authorize' ||
    url.searchParams.getAll('provider').length !== 1 ||
    url.searchParams.getAll('redirect_to').length !== 1 ||
    url.searchParams.get('provider') !== 'google' ||
    url.searchParams.get('redirect_to') !== callback ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new IdentityError(503, 'Google sign-in is unavailable.');
  return url;
}

export function googleCallbackCode(value: string, appOrigin: string) {
  const url = new URL(value);
  if (url.origin !== appOrigin || url.searchParams.getAll('code').length !== 1)
    throw new IdentityError(400, 'Google sign-in response is invalid.');
  const code = url.searchParams.get('code');
  if (!code || code.length > 2048 || !/^[\x21-\x7e]+$/.test(code))
    throw new IdentityError(400, 'Google sign-in response is invalid.');
  return code;
}
