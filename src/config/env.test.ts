import { expect, it } from 'vitest';
import { parseEnvironment } from './env';

it('allows a service-free local foundation', () =>
  expect(parseEnvironment({}).appOrigin).toBe('http://localhost:3000'));
it('accepts a production HTTPS origin', () =>
  expect(
    parseEnvironment({
      APP_ORIGIN: 'https://college.example',
      NODE_ENV: 'production',
    }).appOrigin,
  ).toBe('https://college.example'));
it.each([
  '',
  'invalid',
  'ftp://college.example',
  'https://user:pass@college.example',
  'https://college.example/path',
  'https://college.example/?key=secret',
  'https://college.example/#fragment',
])('rejects invalid origin %s', (APP_ORIGIN) =>
  expect(() => parseEnvironment({ APP_ORIGIN })).toThrow(),
);
it('rejects production non-loopback HTTP', () =>
  expect(() =>
    parseEnvironment({
      APP_ORIGIN: 'http://college.example',
      NODE_ENV: 'production',
    }),
  ).toThrow());
it('allows local production smoke tests', () =>
  expect(parseEnvironment({ NODE_ENV: 'production' }).appOrigin).toBe(
    'http://localhost:3000',
  ));
