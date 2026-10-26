import { isAuthError } from '@supabase/supabase-js';
import { IdentityConfigurationError } from '../config/identity';

export class IdentityError extends Error {
  constructor(
    public readonly status: 400 | 401 | 403 | 413 | 415 | 503,
    message: string,
  ) {
    super(message);
  }
}

export function authenticationError(error: unknown): IdentityError {
  if (
    isAuthError(error) &&
    error.status !== undefined &&
    error.status < 500 &&
    error.status !== 429
  ) {
    return new IdentityError(
      401,
      'Sign-in is required or the session is invalid.',
    );
  }
  return new IdentityError(
    503,
    'Authentication service is unavailable. Please try again.',
  );
}

export function publicIdentityError(error: unknown): IdentityError {
  if (error instanceof IdentityError) return error;
  if (error instanceof IdentityConfigurationError)
    return new IdentityError(
      503,
      'Identity is not configured. Contact the application operator.',
    );
  // Do not leak tokens, credentials, SQL or personal details from upstream errors.
  console.error('Identity operation failed unexpectedly; request denied.');
  return new IdentityError(
    503,
    'Identity service is unavailable. Please try again.',
  );
}
