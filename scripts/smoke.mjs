// Run against a local `npm start` process. No external service or test data needed.
import assert from 'node:assert/strict';

const origin = process.env.SMOKE_ORIGIN ?? 'http://localhost:3000';
const response = await fetch(origin);
assert.equal(response.status, 200);
assert.match(response.headers.get('content-type') ?? '', /text\/html/);
const html = await response.text();
assert.match(html, /Academic Activity workspace/);
assert.match(html, /No private records are shown on this public page/);
assert.match(html, /Open dashboard/);
assert.doesNotMatch(html, /<button|<form|<input/);
const missing = await fetch(new URL('/api/students', origin));
assert.equal(missing.status, 404);
const protectedDashboard = await fetch(new URL('/dashboard/student', origin), {
  redirect: 'manual',
});
assert.equal(protectedDashboard.status, 307);
assert.equal(
  new URL(protectedDashboard.headers.get('location'), origin).pathname,
  '/login',
);
console.log(
  'PASS: public HTML, honest dashboard route, no private controls, absent student API',
);
const identity = await fetch(new URL('/api/me', origin));
assert.ok(
  [401, 503].includes(identity.status),
  `Unexpected anonymous identity status: ${identity.status}`,
);
assert.match(identity.headers.get('cache-control') ?? '', /no-store/);
const payload = await identity.json();
assert.equal(typeof payload.error, 'string');
assert.equal(payload.profile, undefined);
console.log(
  `PASS: anonymous identity request denied (${identity.status}); private data not returned`,
);
