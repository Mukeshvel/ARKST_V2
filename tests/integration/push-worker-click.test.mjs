import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile('public/arkst-push-sw.js', 'utf8');
const origin = 'http://127.0.0.1:3000';
const activity = '11111111-1111-4111-8111-111111111111';

function clickHarness(clients) {
  const listeners = new Map();
  const self = {
    location: { origin },
    clients,
    addEventListener: (type, handler) => listeners.set(type, handler),
  };
  vm.runInNewContext(source, { self, URL });
  return async (url) => {
    let task;
    let closed = false;
    listeners.get('notificationclick')({
      notification: {
        data: { url },
        close: () => {
          closed = true;
        },
      },
      waitUntil: (promise) => {
        task = promise;
      },
    });
    await task;
    assert.equal(closed, true);
  };
}

test('notification click opens and focuses the validated Activity URL', async () => {
  const calls = [];
  const click = clickHarness({
    openWindow: async (url) => {
      calls.push(['open', url]);
      return { focus: async () => calls.push(['focus']) };
    },
    matchAll: async () => {
      throw new Error('An opened window needs no fallback.');
    },
  });
  await click(`/dashboard/student?activity=${activity}`);
  assert.deepEqual(calls, [
    ['open', `${origin}/dashboard/student?activity=${activity}`],
    ['focus'],
  ]);
});

test('notification click falls back to an existing same-origin tab', async () => {
  const calls = [];
  const click = clickHarness({
    openWindow: async () => {
      throw new Error('Browser declined a new tab.');
    },
    matchAll: async () => [
      {
        url: `${origin}/dashboard/notifications`,
        focus: async () => calls.push(['focus']),
        navigate: async (url) => calls.push(['navigate', url]),
      },
    ],
  });
  await click(`/dashboard/student?activity=${activity}`);
  assert.deepEqual(calls, [
    ['focus'],
    ['navigate', `${origin}/dashboard/student?activity=${activity}`],
  ]);
});

test('notification click rejects untrusted paths before opening a window', async () => {
  const click = clickHarness({
    openWindow: async () => {
      throw new Error('Untrusted path was opened.');
    },
  });
  await click('https://evil.example/');
  await click('/dashboard/student?activity=not-a-uuid');
});
