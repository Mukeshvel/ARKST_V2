import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { localFetch, localUrl } from '../tests/integration/local-helpers.mjs';
import { runAuthorizedSchedules } from './lib/recurring-runner.mjs';

const execute = promisify(execFile);
async function main() {
  assert.equal(process.env.APP_ENV, 'local', 'Require APP_ENV=local');
  assert.equal(process.argv.length, 2, 'This runner takes no arguments.');
  if (
    (!process.env.ARKST_SCHEDULER_EMAIL ||
      !process.env.ARKST_SCHEDULER_PASSWORD) &&
    existsSync('.env.scheduler.local')
  )
    process.loadEnvFile('.env.scheduler.local');
  assert.ok(
    process.env.ARKST_SCHEDULER_EMAIL && process.env.ARKST_SCHEDULER_PASSWORD,
    'An approved local scheduler staff login is required.',
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
  const origin = localUrl(
    settings.API_URL,
    ['http:', 'https:'],
    'Local Supabase',
  ).origin;
  const client = createClient(origin, settings.ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch: localFetch(origin) },
  });
  const signIn = await client.auth.signInWithPassword({
    email: process.env.ARKST_SCHEDULER_EMAIL,
    password: process.env.ARKST_SCHEDULER_PASSWORD,
  });
  if (signIn.error || !signIn.data.user)
    throw new Error('Real scheduler staff sign-in failed.');
  const { schedules, published, blocked, existing } =
    await runAuthorizedSchedules(client);
  console.log(
    `Real local recurring runner: ${schedules} active schedules; ${published} published, ${blocked} blackout-blocked, ${existing} already recorded.`,
  );
  const signedOut = await client.auth.signOut({ scope: 'local' });
  if (signedOut.error)
    throw new Error('Scheduler local session cleanup failed.');
}
main().catch((error) => {
  console.error(
    'Local recurring runner failed:',
    error instanceof Error
      ? error.message.replace(/https?:\/\/\S+/g, '[local URL]')
      : 'unknown error',
  );
  process.exitCode = 1;
});
