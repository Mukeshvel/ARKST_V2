import 'server-only';
import { createIdentityClient } from './server';
import { authenticationError, IdentityError } from './errors';
import { loadOwnIdentity } from '@/data/identity';

export async function requireOwnIdentity(writable = false) {
  const client = await createIdentityClient(writable);
  const { data: claims, error: claimsError } = await client.auth.getClaims();
  if (claimsError) throw authenticationError(claimsError);
  if (
    !claims?.claims.sub ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      claims.claims.sub,
    )
  )
    throw new IdentityError(
      401,
      'Sign-in is required or the session is invalid.',
    );
  // Confirm the current Auth user, not merely an unexpired decoded token.
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error) throw authenticationError(error);
  if (!user || user.id !== claims.claims.sub)
    throw new IdentityError(
      401,
      'Sign-in is required or the session is invalid.',
    );
  return loadOwnIdentity(client, user.id);
}
