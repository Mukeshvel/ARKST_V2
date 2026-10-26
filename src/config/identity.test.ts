import { expect, it } from 'vitest';
import { parseIdentityEnvironment } from './identity';

const local = {
  APP_ENV: 'local',
  APP_ORIGIN: 'http://127.0.0.1:3000',
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_configuration_test_only',
};
it('keeps an unconfigured foundation disconnected', () =>
  expect(parseIdentityEnvironment({})).toBeNull());
it('accepts explicit isolated local configuration', () =>
  expect(parseIdentityEnvironment(local)).toMatchObject({
    local: true,
    secureCookies: false,
  }));
it('requires a complete configuration', () =>
  expect(() =>
    parseIdentityEnvironment({ SUPABASE_URL: local.SUPABASE_URL }),
  ).toThrow());
it.each(['https://project.supabase.co', 'http://192.168.1.2:54321'])(
  'rejects non-loopback local backend %s',
  (SUPABASE_URL) =>
    expect(() =>
      parseIdentityEnvironment({ ...local, SUPABASE_URL }),
    ).toThrow(),
);
it('rejects a hosted app using local credentials', () =>
  expect(() =>
    parseIdentityEnvironment({
      ...local,
      APP_ORIGIN: 'https://college.example',
    }),
  ).toThrow());
it.each(['', 'production', 'test'])(
  'requires explicit environment mode %s',
  (APP_ENV) =>
    expect(() => parseIdentityEnvironment({ ...local, APP_ENV })).toThrow(),
);
it.each(['sb_secret_never_accepted', 'invalid', 'YOUR_PUBLIC_PUBLISHABLE_KEY'])(
  'rejects secret or invalid key configuration',
  (SUPABASE_PUBLISHABLE_KEY) =>
    expect(() =>
      parseIdentityEnvironment({ ...local, SUPABASE_PUBLISHABLE_KEY }),
    ).toThrow(),
);
it('accepts hosted HTTPS configuration but disables local password login', () =>
  expect(
    parseIdentityEnvironment({
      ...local,
      APP_ENV: 'hosted',
      APP_ORIGIN: 'https://college.example',
      SUPABASE_URL: 'https://project.supabase.co',
    }),
  ).toMatchObject({ local: false, secureCookies: true }));
it('rejects hosted HTTP', () =>
  expect(() =>
    parseIdentityEnvironment({ ...local, APP_ENV: 'hosted' }),
  ).toThrow());
it.each([
  'http://user:pass@localhost:54321',
  'http://localhost:54321/path',
  'http://localhost:54321/?token=value',
  'http://localhost:54321/#fragment',
  'not-a-url',
])('rejects unsafe endpoint shapes', (SUPABASE_URL) =>
  expect(() => parseIdentityEnvironment({ ...local, SUPABASE_URL })).toThrow(),
);
it('rejects a legacy service-role JWT as application configuration', () => {
  // Configuration-only test string, never used as an authenticated session.
  const value = `header.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`;
  expect(() =>
    parseIdentityEnvironment({ ...local, SUPABASE_PUBLISHABLE_KEY: value }),
  ).toThrow();
});
