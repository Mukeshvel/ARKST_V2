/** Public metadata origin; identity configuration is validated separately. */
export function parseEnvironment(env: Record<string, string | undefined>) {
  const raw = env.APP_ORIGIN ?? 'http://localhost:3000';
  let origin: URL;
  try {
    origin = new URL(raw);
  } catch {
    throw new Error('APP_ORIGIN must be an absolute HTTP(S) origin');
  }
  if (
    !['http:', 'https:'].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash
  ) {
    throw new Error(
      'APP_ORIGIN must be an HTTP(S) origin without credentials, path, query or fragment',
    );
  }
  if (
    env.NODE_ENV === 'production' &&
    origin.protocol !== 'https:' &&
    !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)
  ) {
    throw new Error('Production APP_ORIGIN must use HTTPS except on loopback');
  }
  return { appOrigin: origin.origin };
}
