import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { localFetch, localUrl } from '../tests/integration/local-helpers.mjs';

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
  const grants = await client.rpc('department_operation_options');
  if (grants.error || !Array.isArray(grants.data))
    throw new Error('Calendar grants could not be loaded.');
  let schedules = 0,
    published = 0,
    blocked = 0,
    existing = 0;
  for (const department of grants.data.filter((row) => row.manageCalendar)) {
    const overview = await client.rpc('calendar_overview', {
      p_department: department.departmentId,
    });
    if (overview.error || !Array.isArray(overview.data?.schedules))
      throw new Error('Calendar overview failed for an approved department.');
    for (const schedule of overview.data.schedules.filter(
      (row) => !row.paused,
    )) {
      const run = await client.rpc('run_due_recurring_schedule', {
        p_schedule: schedule.id,
      });
      if (run.error || !run.data || typeof run.data.published !== 'number')
        throw new Error(
          `Recurring generation failed for schedule ${schedule.id}; database code ${run.error?.code ?? 'unavailable'}.`,
        );
      schedules++;
      published += run.data.published;
      blocked += run.data.blocked;
      existing += run.data.existing;
    }
  }
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
