import 'server-only';
import { createServerClient, type CookieOptionsWithName } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
  IdentityConfigurationError,
  parseIdentityEnvironment,
} from '@/config/identity';

export const AUTH_COOKIE = 'arkst-session';

export function identityConfig() {
  const config = parseIdentityEnvironment(process.env);
  if (!config)
    throw new IdentityConfigurationError('Identity is not configured.');
  return config;
}

export function sessionOptions(secure: boolean): CookieOptionsWithName {
  return {
    name: AUTH_COOKIE,
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
  };
}

export async function createIdentityClient(writable = false) {
  const config = identityConfig();
  const store = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: sessionOptions(config.secureCookies),
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          cache: 'no-store',
          signal: AbortSignal.timeout(10000),
        }),
    },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => {
        if (!writable)
          throw new Error(
            'Session refresh must occur in Proxy before rendering.',
          );
        for (const { name, value, options } of values)
          store.set(name, value, options);
      },
    },
  });
}

export async function clearApplicationSession() {
  const store = await cookies();
  for (const cookie of store.getAll()) {
    if (
      cookie.name === AUTH_COOKIE ||
      cookie.name.startsWith(`${AUTH_COOKIE}.`) ||
      cookie.name.startsWith(`${AUTH_COOKIE}-`)
    )
      store.set(cookie.name, '', {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 0,
        secure: identityConfig().secureCookies,
      });
  }
}
