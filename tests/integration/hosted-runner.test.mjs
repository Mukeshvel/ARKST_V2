import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hostedRunnerConfig } from '../../scripts/run-recurring-hosted.mjs';
import {
  runAuthorizedSchedules,
  scheduleThroughDate,
} from '../../scripts/lib/recurring-runner.mjs';

const env = {
  APP_ENV: 'hosted',
  ARKST_HOSTED_RUNNER_ENABLED: 'true',
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  ARKST_SCHEDULER_EMAIL: 'approved@example.test',
  ARKST_SCHEDULER_PASSWORD: 'synthetic-test-only',
};
test('hosted runner refuses local, HTTP, missing credentials and implicit activation', () => {
  assert.equal(hostedRunnerConfig(env).url, env.SUPABASE_URL);
  for (const bad of [
    { APP_ENV: 'local' },
    { ARKST_HOSTED_RUNNER_ENABLED: 'false' },
    { SUPABASE_URL: 'http://project.supabase.co' },
    { SUPABASE_URL: 'https://localhost:54321' },
    { SUPABASE_URL: 'https://project.supabase.co/path' },
    { ARKST_SCHEDULER_PASSWORD: '' },
  ])
    assert.throws(() => hostedRunnerConfig({ ...env, ...bad }));
});
test('runner uses only granted unpaused schedules and reports database failures', async () => {
  const calls = [];
  const client = {
    rpc: async (name, args) => {
      calls.push([name, args]);
      if (name === 'department_operation_options')
        return {
          data: [
            { departmentId: 'denied', manageCalendar: false },
            { departmentId: 'granted', manageCalendar: true },
          ],
        };
      if (name === 'calendar_overview')
        return {
          data: {
            schedules: [
              { id: 'paused', paused: true, timezone: 'Asia/Kolkata' },
              { id: 'active', paused: false, timezone: 'Asia/Kolkata' },
            ],
          },
        };
      return { data: { published: 1, blocked: 2, existing: 3 } };
    },
  };
  assert.deepEqual(await runAuthorizedSchedules(client), {
    schedules: 1,
    published: 1,
    blocked: 2,
    existing: 3,
  });
  assert.deepEqual(
    calls.map(([name]) => name),
    [
      'department_operation_options',
      'calendar_overview',
      'run_due_recurring_schedule',
    ],
  );
  assert.equal(calls[1][1].p_department, 'granted');
  assert.equal(calls[2][1].p_schedule, 'active');
  await assert.rejects(
    runAuthorizedSchedules({ rpc: async () => ({ error: { code: '42501' } }) }),
  );
});
test('hosted horizon follows the schedule timezone', () => {
  assert.equal(
    scheduleThroughDate('Asia/Kolkata', 1, new Date('2026-10-28T20:00:00Z')),
    '2026-10-30',
  );
  assert.equal(
    scheduleThroughDate('UTC', 1, new Date('2026-10-28T20:00:00Z')),
    '2026-10-29',
  );
  assert.throws(() => scheduleThroughDate('Asia/Kolkata', 29));
});
