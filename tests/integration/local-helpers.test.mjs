import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localTestConfiguration } from './local-helpers.mjs';

// Pure guard tests only. These values never contact a service or authenticate a user.
const env = {
  APP_ENV: 'local',
  LOCAL_IDENTITY_TESTS: '1',
  APP_ORIGIN: 'http://127.0.0.1:3000',
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_PUBLISHABLE_KEY: 'guard-test-placeholder',
  LOCAL_SUPABASE_SERVICE_ROLE_KEY: 'guard-test-placeholder',
  LOCAL_DATABASE_URL: 'postgresql://local:placeholder@127.0.0.1:54322/postgres',
};

test('requires explicit disposable local environment opt-in', () => {
  assert.throws(() => localTestConfiguration({}), /BLOCKED/);
  assert.throws(
    () => localTestConfiguration({ ...env, APP_ENV: 'production' }),
    /BLOCKED/,
  );
  assert.throws(
    () => localTestConfiguration({ ...env, LOCAL_IDENTITY_TESTS: '0' }),
    /BLOCKED/,
  );
});

test('accepts only an explicitly configured local stack', () => {
  assert.equal(localTestConfiguration(env).supabaseOrigin, env.SUPABASE_URL);
});

for (const name of ['APP_ORIGIN', 'SUPABASE_URL', 'LOCAL_DATABASE_URL']) {
  test(`rejects remote ${name}`, () => {
    const remote =
      name === 'LOCAL_DATABASE_URL'
        ? 'postgresql://user:pass@database.example/postgres'
        : 'https://remote.example';
    assert.throws(
      () => localTestConfiguration({ ...env, [name]: remote }),
      /loopback/,
    );
  });
  test(`rejects missing ${name}`, () => {
    assert.throws(
      () => localTestConfiguration({ ...env, [name]: '' }),
      /Missing/,
    );
  });
}

test('rejects URL parameters that could override database connection targets', () => {
  assert.throws(
    () =>
      localTestConfiguration({
        ...env,
        LOCAL_DATABASE_URL: `${env.LOCAL_DATABASE_URL}?host=remote.example`,
      }),
    /loopback/,
  );
});

test('rejects URL credentials and application path prefixes', () => {
  assert.throws(
    () =>
      localTestConfiguration({
        ...env,
        SUPABASE_URL: 'http://user:pass@127.0.0.1:54321',
      }),
    /credentials/,
  );
  assert.throws(
    () =>
      localTestConfiguration({
        ...env,
        APP_ORIGIN: 'http://127.0.0.1:3000/prefix',
      }),
    /origin/,
  );
});
