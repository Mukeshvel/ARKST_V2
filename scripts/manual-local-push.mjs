// Local-only, synthetic browser-delivery fixture. No hosted credentials or data.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { promisify } from 'node:util';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import {
  AppBrowser,
  localFetch,
  localTestConfiguration,
  noDatabaseError,
} from '../tests/integration/local-helpers.mjs';
import { createWebPushSender, dispatchDue } from './lib/push-dispatch.mjs';

const run = promisify(execFile);
const statePath = '.env.push-manual-state.local';
const command = process.argv[2];
assert.ok(
  ['setup', 'verify', 'publish', 'dispatch', 'inspect', 'cleanup'].includes(
    command,
  ),
  'Use setup, verify, publish, dispatch, inspect or cleanup.',
);
const { stdout } = await run(
  process.execPath,
  ['node_modules/supabase/dist/supabase.js', 'status', '--output', 'json'],
  {
    env: { ...process.env, SUPABASE_HOME: path.resolve('.supabase-home') },
    windowsHide: true,
  },
);
const local = JSON.parse(stdout);
const appOrigin = 'http://127.0.0.1:3000';
const config = localTestConfiguration({
  ...process.env,
  APP_ORIGIN: appOrigin,
  SUPABASE_URL: local.API_URL,
  SUPABASE_PUBLISHABLE_KEY: local.ANON_KEY,
  LOCAL_DATABASE_URL: local.DB_URL,
  LOCAL_SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY,
});
const authOptions = {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: localFetch(config.supabaseOrigin) },
};
const admin = createClient(
  config.supabaseOrigin,
  config.serviceKey,
  authOptions,
);
const db = new pg.Client({ connectionString: config.databaseUrl });
await db.connect();
const save = (state) =>
  writeFile(statePath, JSON.stringify(state, null, 2), { mode: 0o600 });
const load = async () => JSON.parse(await readFile(statePath, 'utf8'));
const browser = async (account) => {
  const session = new AppBrowser(appOrigin);
  await session.login(account);
  return session;
};
const request = async (session, route, method, body) =>
  session.request(route, {
    method,
    headers: { Origin: appOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
try {
  if (command === 'setup') {
    try {
      await readFile(statePath);
      throw new Error(
        'Manual fixture already exists; preserve or clean it first.',
      );
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const state = {
      tag: randomBytes(6).toString('hex'),
      department: randomUUID(),
      section: randomUUID(),
      users: [],
    };
    await save(state);
    await db.query(
      "insert into public.scopes(id,name,kind) values($1,$2,'department')",
      [state.department, `Manual push ${state.tag}`],
    );
    await db.query(
      "insert into public.scopes(id,name,kind,parent_id) values($1,'Section A','section',$2)",
      [state.section, state.department],
    );
    for (const [label, kind] of [
      ['creator', 'staff'],
      ['recipient', 'student'],
      ['outsider', 'student'],
    ]) {
      const person = {
        label,
        email: `arkst-manual-push-${state.tag}-${label}@example.test`,
        password: `T!${randomBytes(24).toString('base64url')}`,
      };
      person.id = noDatabaseError(
        await admin.auth.admin.createUser({
          email: person.email,
          password: person.password,
          email_confirm: true,
        }),
        'create synthetic Auth account',
      ).user.id;
      state.users.push(person);
      await save(state);
      noDatabaseError(
        await admin.from('profiles').insert({
          id: person.id,
          display_name: `Manual push ${label}`,
          account_kind: kind,
          staff_classification: kind === 'staff' ? 'teaching' : null,
          is_active: true,
        }),
        'create synthetic profile',
      );
    }
    const [creator, recipient] = state.users;
    const {
      rows: [responsibility],
    } = await db.query(
      `insert into public.responsibility_assignments
        (user_id,role,scope_id,starts_at)
        values($1,'teacher',$2,now()-interval '1 day') returning id`,
      [creator.id, state.department],
    );
    state.responsibility = responsibility.id;
    await save(state);
    await db.query(
      `insert into public.activity_capabilities
        (responsibility_id,category_key,can_create)
        values($1,'general',true)`,
      [responsibility.id],
    );
    await db.query(
      `insert into public.department_student_roster
        (department_scope_id,section_scope_id,external_student_id,
         display_name,linked_student_id,created_by)
        values($1,$2,$3,$4,$5,$6)`,
      [
        state.department,
        state.section,
        `MANUAL-${state.tag}`,
        'Synthetic manual push recipient',
        recipient.id,
        creator.id,
      ],
    );
    await db.query(
      `insert into public.student_scope_memberships(student_id,scope_id)
        values($1,$2)`,
      [recipient.id, state.section],
    );
    console.log(
      `Fixture ready at ${appOrigin}; recipient email: ${recipient.email}`,
    );
    console.log(`Read the one-time password locally from ${statePath}.`);
  } else {
    const state = await load();
    const [creator, recipient, outsider] = state.users;
    if (command === 'verify') {
      const { rows } = await db.query(
        `select user_id,endpoint,p256dh,auth_secret from public.push_subscriptions
          where user_id=any($1::uuid[]) and active`,
        [[recipient.id, outsider.id]],
      );
      assert.equal(
        rows.length,
        1,
        'Exactly one active fixture subscription required.',
      );
      assert.equal(rows[0].user_id, recipient.id, 'Wrong subscription owner.');
      const recipientSession = await browser(recipient);
      const outsiderSession = await browser(outsider);
      const own = await request(
        recipientSession,
        '/api/push/subscription',
        'PUT',
        {
          endpoint: rows[0].endpoint,
        },
      );
      assert.equal(own.status, 200);
      assert.equal((await own.json()).enabled, true);
      const other = await request(
        outsiderSession,
        '/api/push/subscription',
        'PUT',
        {
          endpoint: rows[0].endpoint,
        },
      );
      assert.equal(other.status, 200);
      assert.equal((await other.json()).enabled, false);
      const steal = await request(
        outsiderSession,
        '/api/push/subscription',
        'POST',
        {
          endpoint: rows[0].endpoint,
          expirationTime: null,
          keys: { p256dh: rows[0].p256dh, auth: rows[0].auth_secret },
        },
      );
      assert.equal(steal.status, 403);
      console.log(
        'PASS: one genuine active subscription belongs to recipient; outsider status false and registration 403.',
      );
    }
    if (command === 'publish') {
      state.activityIds ??= state.activityId ? [state.activityId] : [];
      assert.ok(
        state.activityIds.length < 3,
        'Only one post-fix click check is allowed.',
      );
      const creatorSession = await browser(creator);
      const now = Date.now();
      const response = await request(
        creatorSession,
        '/api/activities/selected',
        'POST',
        {
          category: 'general',
          departmentScopeId: state.department,
          counselingOnly: false,
          title: `Manual Web Push ${state.tag}${['', ' retry', ' click check'][state.activityIds.length]}`,
          description: 'Synthetic local delivery verification activity.',
          startsAt: new Date(now - 60_000).toISOString(),
          deadlineAt: new Date(now + 3_600_000).toISOString(),
          endsAt: new Date(now + 7_200_000).toISOString(),
          requiresVerification: false,
          studentIds: [recipient.id],
        },
      );
      assert.equal(
        response.status,
        201,
        `Activity API returned ${response.status}`,
      );
      state.activityId = (await response.json()).id;
      state.activityIds.push(state.activityId);
      await save(state);
      const { rows } = await db.query(
        `select o.id,n.recipient_id from public.notification_outbox o
          join public.notifications n on n.id=o.notification_id
          where n.source_kind='activity' and n.source_id=$1`,
        [state.activityId],
      );
      assert.equal(rows.length, 1);
      assert.equal(rows[0].recipient_id, recipient.id);
      console.log(
        'PASS: real authorized Activity API created one recipient outbox job.',
      );
    }
    if (command === 'dispatch' || command === 'inspect') {
      assert.ok(state.activityId, 'Publish the Activity first.');
      const { rows } = await db.query(
        `select o.id,n.id as notification_id,n.recipient_id from public.notification_outbox o
          join public.notifications n on n.id=o.notification_id
          where n.source_kind='activity' and n.source_id=$1`,
        [state.activityId],
      );
      assert.equal(rows.length, 1);
      if (command === 'dispatch') {
        process.loadEnvFile('.env.push.local');
        const send = createWebPushSender({
          publicKey: process.env.PUSH_VAPID_PUBLIC_KEY,
          privateKey: process.env.PUSH_VAPID_PRIVATE_KEY,
          subject: process.env.PUSH_VAPID_SUBJECT,
        });
        const result = await dispatchDue({
          databaseUrl: config.databaseUrl,
          outboxIds: [rows[0].id],
          send,
        });
        console.log(
          `Dispatcher: ${result.claimed} claimed, ${result.attempts} provider attempts.`,
        );
      }
      const { rows: deliveries } = await db.query(
        `select d.state,d.last_status,d.last_error_class
          from public.push_deliveries d
          join public.push_subscriptions s on s.id=d.subscription_id
          where d.outbox_id=$1 and s.user_id=$2`,
        [rows[0].id, recipient.id],
      );
      console.log('Delivery states:', JSON.stringify(deliveries));
      if (command === 'inspect') {
        assert.equal(rows[0].recipient_id, recipient.id);
        const recipientSession = await browser(recipient);
        const outsiderSession = await browser(outsider);
        const route = `/api/notifications/${rows[0].notification_id}/push-preview`;
        const own = await recipientSession.request(route);
        const other = await outsiderSession.request(route);
        assert.equal(own.status, 200);
        assert.equal(other.status, 404);
        const preview = await own.json();
        assert.equal(
          preview.url,
          `/dashboard/student?activity=${state.activityId}`,
        );
        console.log(
          'PASS: recipient preview 200 and correct Activity URL; outsider preview 404.',
        );
      }
    }
    if (command === 'cleanup') {
      const ids = state.users.map((person) => person.id);
      await db.query('delete from public.activities where id=any($1::uuid[])', [
        state.activityIds ?? (state.activityId ? [state.activityId] : []),
      ]);
      await db.query(
        'delete from public.department_student_roster where department_scope_id=$1',
        [state.department],
      );
      await db.query(
        'delete from public.student_scope_memberships where scope_id=$1',
        [state.section],
      );
      await db.query(
        'delete from public.activity_capabilities where responsibility_id=$1',
        [state.responsibility ?? null],
      );
      await db.query(
        'delete from public.responsibility_assignments where user_id=any($1::uuid[])',
        [ids],
      );
      for (const person of state.users.toReversed())
        noDatabaseError(
          await admin.auth.admin.deleteUser(person.id),
          'remove synthetic account',
        );
      await db.query('delete from public.scopes where id=$1', [state.section]);
      await db.query('delete from public.scopes where id=$1', [
        state.department,
      ]);
      await unlink(statePath);
      console.log('Synthetic manual fixture removed.');
    }
  }
} finally {
  await db.end();
}
