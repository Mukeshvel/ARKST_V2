import { expect, it } from 'vitest';
import { googleAuthorizationUrl, googleCallbackCode } from './google-oauth';

const origin = 'https://project.supabase.co';
const callback = 'https://college.example/auth/google/callback';
it('accepts only the expected Google authorize URL and exact callback', () => {
  const url = `${origin}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(callback)}&code_challenge=sample`;
  expect(googleAuthorizationUrl(url, origin, callback).href).toBe(url);
  for (const altered of [
    `https://other.example/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(callback)}`,
    `${origin}/auth/v1/authorize?provider=github&redirect_to=${encodeURIComponent(callback)}`,
    `${origin}/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fevil.example`,
  ])
    expect(() => googleAuthorizationUrl(altered, origin, callback)).toThrow();
});
it('accepts only one callback code on the exact app origin', () => {
  expect(
    googleCallbackCode(`${callback}?code=abc-123`, 'https://college.example'),
  ).toBe('abc-123');
  expect(() =>
    googleCallbackCode(
      `${callback}?code=one&code=two`,
      'https://college.example',
    ),
  ).toThrow();
  expect(() =>
    googleCallbackCode(
      `https://other.example/auth/google/callback?code=abc`,
      'https://college.example',
    ),
  ).toThrow();
  expect(() =>
    googleCallbackCode(`${callback}?code=abc%0A`, 'https://college.example'),
  ).toThrow();
});
