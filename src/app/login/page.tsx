import Link from 'next/link';
import { parseIdentityEnvironment } from '@/config/identity';

export const dynamic = 'force-dynamic';
export default function Login() {
  let local = false;
  try {
    local = parseIdentityEnvironment(process.env)?.local ?? false;
  } catch {
    /* Configuration failure is displayed explicitly below; no sign-in is offered. */
  }
  return (
    <main>
      <Link href="/">ARKST foundation</Link>
      <h1>Sign in</h1>
      {local ? (
        <>
          <p>
            Isolated local development only. Use an account provisioned by the
            local operator. No signup is available.
          </p>
          <form action="/auth/login" method="post" className="identity-form">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              maxLength={254}
              required
            />
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              maxLength={1024}
              required
            />
            <button type="submit">Sign in to local Supabase</button>
          </form>
        </>
      ) : (
        <p role="status">
          Interactive sign-in is unavailable. Local identity must be configured
          by the operator; hosted onboarding and Google OAuth are not enabled.
        </p>
      )}
    </main>
  );
}
