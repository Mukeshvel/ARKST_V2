import Link from 'next/link';
import { parseIdentityEnvironment } from '@/config/identity';

export const dynamic = 'force-dynamic';
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  let local = false;
  let google = false;
  try {
    const config = parseIdentityEnvironment(process.env);
    local = config?.local ?? false;
    google = config?.googleOAuthEnabled ?? false;
  } catch {
    /* Configuration failure is displayed explicitly below; no sign-in is offered. */
  }
  return (
    <main>
      <Link href="/">ARKST foundation</Link>
      <h1>Sign in</h1>
      {(await searchParams).error === 'access' && (
        <p role="alert">
          Your Google account is not approved for ARKST. Contact the department
          administrator.
        </p>
      )}
      {(await searchParams).error === 'service' && (
        <p role="alert">
          Google sign-in could not be completed. Please try again or contact the
          operator.
        </p>
      )}
      {google && (
        <form action="/auth/google" method="post">
          <button type="submit">Sign in with Google</button>
        </form>
      )}
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
      ) : !google ? (
        <p role="status">
          Interactive sign-in is unavailable. The operator must configure Google
          sign-in and provision your account.
        </p>
      ) : (
        <p>Only administrator-approved existing accounts can enter ARKST.</p>
      )}
    </main>
  );
}
