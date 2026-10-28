import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { createWebPushSender, dispatchDue } from './lib/push-dispatch.mjs';

const execute = promisify(execFile);
async function main() {
  assert.equal(process.env.APP_ENV, 'local', 'Require APP_ENV=local');
  assert.ok(
    process.argv.length === 2 ||
      (process.argv.length === 3 && process.argv[2] === '--watch'),
    'Only --watch is supported.',
  );
  process.loadEnvFile('.env.push.local');
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
  const status = JSON.parse(stdout);
  const database = new URL(status.DB_URL);
  assert.ok(
    ['127.0.0.1', 'localhost', '[::1]'].includes(database.hostname),
    'Local dispatcher requires a loopback database.',
  );
  const send = createWebPushSender({
    publicKey: process.env.PUSH_VAPID_PUBLIC_KEY,
    privateKey: process.env.PUSH_VAPID_PRIVATE_KEY,
    subject: process.env.PUSH_VAPID_SUBJECT,
  });
  do {
    const result = await dispatchDue({ databaseUrl: status.DB_URL, send });
    if (result.claimed || process.argv[2] !== '--watch')
      console.log(
        `Local push dispatch: ${result.claimed} jobs, ${result.attempts} provider attempts, ${result.expired} expired.`,
      );
    if (process.argv[2] !== '--watch') break;
    await new Promise((resolve) =>
      setTimeout(resolve, result.claimed === 20 ? 1000 : 15000),
    );
  } while (true);
}
main().catch((error) => {
  console.error(
    'Local push dispatch failed:',
    error?.code ?? error?.name ?? 'unavailable',
  );
  process.exitCode = 1;
});
