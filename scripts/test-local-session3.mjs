import assert from 'node:assert/strict';
import {
  localTestConfiguration,
  localFetch,
} from '../tests/integration/local-helpers.mjs';

async function main() {
  const config = localTestConfiguration(process.env);
  const request = localFetch(config.appOrigin);
  const page = await request(`${config.appOrigin}/login`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Sign in with Google/);
  console.log(
    'PASS 1: explicitly enabled local test app renders the real Google start action',
  );
  const denied = await request(`${config.appOrigin}/auth/google`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      Origin: 'https://untrusted.invalid',
      'Sec-Fetch-Site': 'cross-site',
    },
  });
  assert.equal(denied.status, 403);
  console.log('PASS 2: cross-origin Google initiation is denied');
  const started = await request(`${config.appOrigin}/auth/google`, {
    method: 'POST',
    redirect: 'manual',
    headers: { Origin: config.appOrigin, 'Sec-Fetch-Site': 'same-origin' },
  });
  assert.equal(started.status, 303);
  const location = new URL(started.headers.get('location'));
  assert.equal(location.origin, config.supabaseOrigin);
  assert.equal(location.pathname, '/auth/v1/authorize');
  assert.equal(location.searchParams.get('provider'), 'google');
  assert.equal(
    location.searchParams.get('redirect_to'),
    `${config.appOrigin}/auth/google/callback`,
  );
  assert.ok(
    started.headers.get('set-cookie')?.includes('code-verifier'),
    'PKCE verifier cookie must be issued',
  );
  console.log(
    'PASS 3: real Supabase client creates an exact-origin Google PKCE authorization and verifier cookie',
  );
  const invalid = await request(
    `${config.appOrigin}/auth/google/callback?code=invalid`,
    { redirect: 'manual' },
  );
  assert.equal(invalid.status, 303);
  assert.equal(new URL(invalid.headers.get('location')).pathname, '/login');
  assert.equal(
    new URL(invalid.headers.get('location')).searchParams.get('error'),
    'service',
  );
  console.log('PASS 4: invalid provider code cannot create an ARKST session');
  console.log(
    'Google provider exchange and hosted login remain unverified without approved external configuration.',
  );
}
main().catch((error) => {
  console.error(`Session 3 local boundary check failed: ${error.message}`);
  process.exitCode = 1;
});
