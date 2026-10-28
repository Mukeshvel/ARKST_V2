// Starts a real production app on an ephemeral loopback port; keys stay in process memory.
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';
import net from 'node:net';
import path from 'node:path';
import webpush from 'web-push';
import {
  localTestConfiguration,
  localFetch,
} from '../tests/integration/local-helpers.mjs';

const execute = promisify(execFile);
async function main() {
  assert.equal(process.env.APP_ENV, 'local', 'Require APP_ENV=local');
  assert.equal(
    process.env.LOCAL_IDENTITY_TESTS,
    '1',
    'Require explicit LOCAL_IDENTITY_TESTS=1',
  );
  const suite = process.argv[2] ?? 'all';
  assert.ok(
    ['all', 'identity', 'activity', 'directory', 'operations', 'push'].includes(
      suite,
    ),
  );
  const { stdout } = await execute(
    process.execPath,
    ['node_modules/supabase/dist/supabase.js', 'status', '--output', 'json'],
    {
      env: { ...process.env, SUPABASE_HOME: path.resolve('.supabase-home') },
      timeout: 30000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    },
  );
  const settings = JSON.parse(stdout);
  const socket = net.createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise((resolve, reject) =>
    socket.close((error) => (error ? reject(error) : resolve())),
  );
  const environment = {
    ...process.env,
    APP_ENV: 'local',
    LOCAL_IDENTITY_TESTS: '1',
    APP_ORIGIN: `http://127.0.0.1:${port}`,
    SUPABASE_URL: settings.API_URL,
    SUPABASE_PUBLISHABLE_KEY: settings.ANON_KEY,
    LOCAL_DATABASE_URL: settings.DB_URL,
    LOCAL_SUPABASE_SERVICE_ROLE_KEY: settings.SERVICE_ROLE_KEY,
  };
  if (suite === 'all' || suite === 'push') {
    const keys = webpush.generateVAPIDKeys();
    environment.PUSH_VAPID_PUBLIC_KEY = keys.publicKey;
    environment.PUSH_VAPID_PRIVATE_KEY = keys.privateKey;
    environment.PUSH_VAPID_SUBJECT = 'mailto:arkst-local@example.test';
  }
  const config = localTestConfiguration(environment);
  const appEnvironment = { ...environment };
  for (const key of Object.keys(appEnvironment)) {
    if (
      /SERVICE_ROLE|SECRET|PRIVATE_KEY|DATABASE_URL|SUPABASE_ACCESS_TOKEN|LOCAL_IDENTITY_TESTS/.test(
        key,
      )
    )
      delete appEnvironment[key];
  }
  const server = spawn(
    process.execPath,
    [
      'node_modules/next/dist/bin/next',
      'start',
      '--hostname',
      '127.0.0.1',
      '--port',
      String(port),
    ],
    {
      env: appEnvironment,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  );
  // Keep Next diagnostics visible, but never print local CLI status/credentials.
  server.stdout.pipe(process.stdout);
  server.stderr.pipe(process.stderr);
  let serverError;
  server.on('error', (error) => {
    serverError = error;
  });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (serverError) throw serverError;
      if (server.exitCode !== null)
        throw new Error('Test app exited before readiness.');
      try {
        const response = await localFetch(config.appOrigin)(
          `${config.appOrigin}/api/me`,
        );
        if (response.status === 401) {
          ready = true;
          break;
        }
      } catch {
        /* Startup polling only; readiness is mandatory below. */
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert.ok(
      ready,
      'Real application readiness failed; no tests may claim success.',
    );
    async function run(script) {
      const child = spawn(process.execPath, [script], {
        env: { ...environment, SMOKE_ORIGIN: config.appOrigin },
        stdio: 'inherit',
        windowsHide: true,
      });
      const [code] = await once(child, 'exit');
      assert.equal(code, 0, `${script} failed`);
    }
    await run('scripts/smoke.mjs');
    if (suite === 'all' || suite === 'identity')
      await run('scripts/test-local-identity.mjs');
    if (suite === 'all' || suite === 'activity')
      await run('scripts/test-local-activities.mjs');
    if (suite === 'all' || suite === 'directory')
      await run('scripts/test-local-directory.mjs');
    if (suite === 'all' || suite === 'operations')
      await run('scripts/test-local-operations.mjs');
    if (suite === 'all' || suite === 'push')
      await run('scripts/test-local-push.mjs');
  } finally {
    if (server.exitCode === null) {
      const stopped = once(server, 'exit');
      server.kill();
      await stopped;
    }
  }
}

main().catch((error) => {
  // Do not print raw child stdout: `supabase status` includes local credentials.
  const message = String(
    error.stack ?? error.message ?? error.code ?? 'Unknown failure',
  )
    .replace(
      /(?:SERVICE_ROLE_KEY|SECRET_KEY|ANON_KEY|PUBLISHABLE_KEY|JWT_SECRET)[^\n]*/gi,
      '[redacted local credential output]',
    )
    .split('\n')
    .slice(0, 5)
    .join('\n');
  console.error('Local verification failed:', message);
  process.exitCode = 1;
});
