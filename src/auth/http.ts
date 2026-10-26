import { IdentityError } from './errors';

export function requireSameOrigin(
  request: Request,
  expectedOrigin: string,
): void {
  if (
    request.headers.get('origin') !== expectedOrigin ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  ) {
    throw new IdentityError(403, 'This request origin is not allowed.');
  }
}

export async function readCredentials(request: Request) {
  if (
    request.headers.get('content-type')?.split(';')[0]?.trim() !==
    'application/x-www-form-urlencoded'
  )
    throw new IdentityError(415, 'Expected a login form.');
  const reader = request.body?.getReader();
  if (!reader) throw new IdentityError(400, 'Email and password are required.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 8192) {
        await reader.cancel();
        throw new IdentityError(413, 'Login form is too large.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const fields = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
  if (
    [...fields.keys()].some((key) => !['email', 'password'].includes(key)) ||
    fields.getAll('email').length !== 1 ||
    fields.getAll('password').length !== 1
  )
    throw new IdentityError(400, 'Only email and password are accepted.');
  const email = fields.get('email')!.trim();
  const password = fields.get('password')!;
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    !password ||
    password.length > 1024
  )
    throw new IdentityError(400, 'Enter a valid email and password.');
  return { email, password };
}

export const privateHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};
