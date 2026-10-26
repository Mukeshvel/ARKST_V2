import { expect, it } from 'vitest';
import { readCredentials, requireSameOrigin } from './http';

const origin = 'http://127.0.0.1:3000';
const request = (body: string, headers: Record<string, string> = {}) =>
  new Request(`${origin}/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      ...headers,
    },
    body,
  });
it('accepts exact same-origin mutation', () =>
  expect(() =>
    requireSameOrigin(request('', { origin }), origin),
  ).not.toThrow());
it.each([
  {},
  { origin: 'https://attacker.example' },
  { origin: 'null' },
  { origin, 'sec-fetch-site': 'cross-site' },
])('rejects missing or cross-site origin', (headers) =>
  expect(() => requireSameOrigin(request('', headers), origin)).toThrow(),
);
it('parses credentials without changing the password', async () =>
  expect(
    await readCredentials(
      request('email=student%40example.test&password=%20local-pass%20'),
    ),
  ).toEqual({ email: 'student@example.test', password: ' local-pass ' }));
it.each([
  'email=x&password=y',
  'email=a%40example.test',
  'email=a%40example.test&password=',
  'email=a%40example.test&email=b%40example.test&password=x',
  'email=a%40example.test&password=x&role=admin',
  'email=a%40example.test&password=x&user_id=other',
])('rejects malformed or extra login fields', async (body) =>
  expect(readCredentials(request(body))).rejects.toMatchObject({ status: 400 }),
);
it('rejects JSON login submissions', async () =>
  expect(
    readCredentials(request('{}', { 'content-type': 'application/json' })),
  ).rejects.toMatchObject({ status: 415 }));
it('bounds streamed input even without Content-Length', async () =>
  expect(
    readCredentials(
      request(`email=a%40example.test&password=${'a'.repeat(9000)}`),
    ),
  ).rejects.toMatchObject({ status: 413 }));
