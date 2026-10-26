import assert from 'node:assert/strict';

const loopbackHosts = new Set(['127.0.0.1', '[::1]', 'localhost']);

function required(env, name) {
  const value = env[name];
  if (!value)
    throw new Error(`Missing ${name}; real local identity tests cannot run.`);
  return value;
}

function localUrl(value, protocols, name, allowCredentials = false) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid local URL.`);
  }
  if (
    !protocols.includes(url.protocol) ||
    !loopbackHosts.has(url.hostname) ||
    url.search ||
    url.hash ||
    (!allowCredentials && (url.username || url.password))
  ) {
    throw new Error(
      `${name} must target loopback with no query/fragment or unsupported credentials.`,
    );
  }
  if (!allowCredentials && url.pathname !== '/')
    throw new Error(`${name} must be an origin without a path.`);
  return url;
}

export function localTestConfiguration(env) {
  if (env.APP_ENV !== 'local' || env.LOCAL_IDENTITY_TESTS !== '1') {
    throw new Error(
      'BLOCKED: set APP_ENV=local and LOCAL_IDENTITY_TESTS=1 only for a dedicated disposable local Supabase instance. No tests were run.',
    );
  }
  const app = localUrl(
    required(env, 'APP_ORIGIN'),
    ['http:', 'https:'],
    'APP_ORIGIN',
  );
  const supabase = localUrl(
    required(env, 'SUPABASE_URL'),
    ['http:', 'https:'],
    'SUPABASE_URL',
  );
  const database = localUrl(
    required(env, 'LOCAL_DATABASE_URL'),
    ['postgres:', 'postgresql:'],
    'LOCAL_DATABASE_URL',
    true,
  );
  return {
    appOrigin: app.origin,
    supabaseOrigin: supabase.origin,
    databaseUrl: database.toString(),
    publicKey: required(env, 'SUPABASE_PUBLISHABLE_KEY'),
    serviceKey: required(env, 'LOCAL_SUPABASE_SERVICE_ROLE_KEY'),
  };
}

/** Refuse redirect hops or requests outside the explicitly selected local service. */
export function localFetch(origin) {
  return async (input, options = {}) => {
    const url = new URL(
      typeof input === 'string' || input instanceof URL ? input : input.url,
    );
    assert.equal(
      url.origin,
      origin,
      'A test attempted to contact an unexpected origin',
    );
    return fetch(input, {
      ...options,
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
    });
  };
}

/** Minimal HTTP cookie jar; no invented sessions. Cookies originate only from the real app. */
export class AppBrowser {
  cookies = new Map();
  constructor(origin) {
    this.origin = origin;
  }
  async request(path, options = {}) {
    const headers = new Headers(options.headers);
    if (this.cookies.size)
      headers.set(
        'Cookie',
        [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; '),
      );
    const response = await localFetch(this.origin)(new URL(path, this.origin), {
      ...options,
      headers,
    });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';', 1)[0];
      const separator = pair.indexOf('=');
      const name = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      if (/max-age=0(?:;|$)/i.test(cookie) || !value) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return response;
  }
  async login(account) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      headers: { Origin: this.origin },
      body: new URLSearchParams({
        email: account.email,
        password: account.password,
      }),
    });
    assert.equal(response.status, 303, 'Real password sign-in must succeed');
    assert.equal(
      new URL(response.headers.get('location'), this.origin).pathname,
      '/profile',
    );
    const sessionCookies = response.headers
      .getSetCookie()
      .filter((cookie) => cookie.startsWith('arkst-session'));
    assert.ok(
      sessionCookies.length > 0,
      'Sign-in must set actual session cookies',
    );
    for (const cookie of sessionCookies) {
      assert.match(cookie, /;\s*HttpOnly(?:;|$)/i);
      assert.match(cookie, /;\s*SameSite=Lax(?:;|$)/i);
      if (this.origin.startsWith('https:'))
        assert.match(cookie, /;\s*Secure(?:;|$)/i);
    }
  }
}

export function noDatabaseError(result, operation) {
  assert.equal(
    result.error,
    null,
    `${operation} failed: ${result.error?.code ?? 'unknown'}`,
  );
  return result.data;
}

export function deniedRead(result) {
  if (result.error)
    assert.equal(
      result.error.code,
      '42501',
      'Only a real permission error counts as denial',
    );
  else assert.deepEqual(result.data, [], 'Private data must not be returned');
}

export function deniedWrite(result) {
  assert.ok(result.error, 'Untrusted write unexpectedly succeeded');
  assert.equal(
    result.error.code,
    '42501',
    'Only a real permission error counts as denial',
  );
}
