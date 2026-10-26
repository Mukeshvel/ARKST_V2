export class IdentityConfigurationError extends Error {}

export function isLoopback(hostname: string): boolean {
  return ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
}

export function parseIdentityEnvironment(
  env: Record<string, string | undefined>,
) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_PUBLISHABLE_KEY;
  if (!url && !key) return null;
  const invalid = () =>
    new IdentityConfigurationError(
      'Identity configuration is missing or invalid.',
    );
  if (
    !url ||
    !key ||
    !env.APP_ORIGIN ||
    !['local', 'hosted'].includes(env.APP_ENV ?? '')
  )
    throw invalid();
  let endpoint: URL;
  let app: URL;
  try {
    endpoint = new URL(url);
    app = new URL(env.APP_ORIGIN);
  } catch {
    throw invalid();
  }
  for (const value of [endpoint, app]) {
    if (
      !['http:', 'https:'].includes(value.protocol) ||
      value.username ||
      value.password ||
      value.pathname !== '/' ||
      value.search ||
      value.hash
    )
      throw invalid();
  }
  const local = env.APP_ENV === 'local';
  if (
    local
      ? !isLoopback(endpoint.hostname) || !isLoopback(app.hostname)
      : endpoint.protocol !== 'https:' || app.protocol !== 'https:'
  )
    throw invalid();
  // This is a configuration guard, not JWT authentication. Supabase verifies sessions.
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
    try {
      const parts = key.split('.');
      if (
        parts.length !== 3 ||
        JSON.parse(Buffer.from(parts[1]!, 'base64url').toString()).role !==
          'anon'
      )
        throw invalid();
    } catch {
      throw invalid();
    }
  }
  return {
    url: endpoint.origin,
    key,
    appOrigin: app.origin,
    local,
    secureCookies: app.protocol === 'https:',
  };
}
