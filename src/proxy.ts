import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { parseIdentityEnvironment } from '@/config/identity';
import { privateHeaders } from '@/auth/http';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  try {
    const settings = parseIdentityEnvironment(process.env);
    if (settings) {
      const client = createServerClient(settings.url, settings.key, {
        cookieOptions: {
          name: 'arkst-session',
          httpOnly: true,
          sameSite: 'lax',
          secure: settings.secureCookies,
          path: '/',
        },
        global: {
          fetch: (input, init) =>
            fetch(input, {
              ...init,
              cache: 'no-store',
              signal: AbortSignal.timeout(10000),
            }),
        },
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (values) => {
            for (const { name, value } of values)
              request.cookies.set(name, value);
            const previous = response.cookies.getAll();
            response = NextResponse.next({ request });
            for (const cookie of previous) response.cookies.set(cookie);
            for (const { name, value, options } of values)
              response.cookies.set(name, value, options);
          },
        },
      });
      // Refresh only. Every protected entry point independently verifies identity.
      const { error } = await client.auth.getClaims();
      if (error)
        console.warn(
          'Session refresh rejected; protected route will verify and deny access.',
        );
    }
  } catch {
    console.warn(
      'Session refresh unavailable; protected route will return an explicit error.',
    );
  }
  for (const [key, value] of Object.entries(privateHeaders))
    response.headers.set(key, value);
  return response;
}

export const config = {
  matcher: [
    '/profile/:path*',
    '/api/me/:path*',
    '/api/activities/:path*',
    '/api/activity-assignments/:path*',
    '/api/staff-directory/:path*',
    '/api/counselor/:path*',
  ],
};
