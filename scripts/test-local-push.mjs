import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { chromium, expect } from '@playwright/test';
import pg from 'pg';
import {
  AppBrowser,
  deniedRead,
  deniedWrite,
  localFetch,
  localTestConfiguration,
  noDatabaseError,
} from '../tests/integration/local-helpers.mjs';
import {
  claimNext,
  classifyPushFailure,
  createWebPushSender,
  dispatchDue,
  processClaim,
  retryDelaySeconds,
} from './lib/push-dispatch.mjs';

async function main() {
  const config = localTestConfiguration(process.env);
  assert.ok(
    process.env.PUSH_VAPID_PUBLIC_KEY && process.env.PUSH_VAPID_PRIVATE_KEY,
  );
  const tag = randomBytes(6).toString('hex');
  const department = randomUUID(),
    section = randomUUID();
  const db = new pg.Client({
    connectionString: config.databaseUrl,
    connectionTimeoutMillis: 5000,
  });
  const users = [];
  const options = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch: localFetch(config.supabaseOrigin) },
  };
  const admin = createClient(config.supabaseOrigin, config.serviceKey, options);
  let connected = false,
    failure,
    passed = 0,
    browser,
    responsibility;
  const cleanupErrors = [];
  async function check(label, action) {
    await action();
    console.log(`PASS ${++passed}: ${label}`);
  }
  async function user(label, kind = 'student') {
    const entry = {
      email: `arkst-push-${tag}-${label}@example.test`,
      password: `T!${randomBytes(24).toString('base64url')}`,
    };
    entry.id = noDatabaseError(
      await admin.auth.admin.createUser({ ...entry, email_confirm: true }),
      'create synthetic local Auth user',
    ).user.id;
    users.push(entry);
    noDatabaseError(
      await admin.from('profiles').insert({
        id: entry.id,
        display_name: `Push ${label}`,
        account_kind: kind,
        staff_classification: kind === 'staff' ? 'teaching' : null,
        is_active: true,
      }),
      'create synthetic profile',
    );
    entry.client = createClient(
      config.supabaseOrigin,
      config.publicKey,
      options,
    );
    noDatabaseError(
      await entry.client.auth.signInWithPassword({
        email: entry.email,
        password: entry.password,
      }),
      'real Supabase sign-in',
    );
    entry.browser = new AppBrowser(config.appOrigin);
    await entry.browser.login(entry);
    return entry;
  }
  async function api(person, path, body, method = 'GET', expected = 200) {
    const response = await person.browser.request(path, {
      method,
      ...(method === 'GET'
        ? {}
        : {
            headers: {
              Origin: config.appOrigin,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          }),
    });
    assert.equal(
      response.status,
      expected,
      `${path}: ${await response.clone().text()}`,
    );
    return response.json();
  }
  async function outboxFor(kind, id) {
    const { rows } = await db.query(
      `select o.id,n.id notification_id,n.recipient_id
      from public.notification_outbox o join public.notifications n on n.id=o.notification_id
      where n.source_kind=$1 and n.source_id=$2 order by o.id`,
      [kind, id],
    );
    return rows;
  }
  function fakeSubscription(index) {
    return {
      endpoint: `https://fcm.googleapis.com/fcm/send/arkst-${tag}-${index}`,
      expirationTime: null,
      keys: { p256dh: 'A'.repeat(87), auth: 'B'.repeat(22) },
    };
  }
  async function announcement(teacher, students, title) {
    return api(
      teacher,
      '/api/announcements',
      {
        departmentScopeId: department,
        mode: 'selected',
        studentIds: students.map((x) => x.id),
        title,
        message: 'Informational local test; no work is required.',
      },
      'POST',
      201,
    );
  }
  const count = async (sql, params = []) =>
    (await db.query(sql, params)).rows[0].n;

  try {
    await db.connect();
    connected = true;
    await db.query(
      "insert into public.scopes(id,name,kind) values($1,$2,'department')",
      [department, `Push ${tag}`],
    );
    await db.query(
      "insert into public.scopes(id,name,kind,parent_id) values($1,'Section A','section',$2)",
      [section, department],
    );
    const teacher = await user('teacher', 'staff');
    const students = [];
    for (let i = 0; i < 6; i++) students.push(await user(`student-${i + 1}`));
    const outsider = await user('outsider');
    ({
      rows: [responsibility],
    } = await db.query(
      `insert into public.responsibility_assignments
      (user_id,role,scope_id,starts_at) values($1,'teacher',$2,now()-interval '1 day') returning id`,
      [teacher.id, department],
    ));
    await db.query(
      `insert into public.activity_capabilities(responsibility_id,category_key,can_create)
      values($1,'general',true)`,
      [responsibility.id],
    );
    for (let i = 0; i < students.length; i++) {
      await db.query(
        `insert into public.department_student_roster
        (department_scope_id,section_scope_id,external_student_id,display_name,linked_student_id,created_by)
        values($1,$2,$3,$4,$5,$6)`,
        [
          department,
          section,
          `PUSH-${i + 1}-${tag}`,
          `Synthetic Push Student ${i + 1}`,
          students[i].id,
          teacher.id,
        ],
      );
      await db.query(
        'insert into public.student_scope_memberships(student_id,scope_id) values($1,$2)',
        [students[i].id, section],
      );
    }

    let activityId, activityJobs;
    await check(
      'six real assigned students receive exact durable inbox and outbox records',
      async () => {
        const title = `Push six ${tag}`;
        const activity = await api(
          teacher,
          '/api/activities/selected',
          {
            category: 'general',
            departmentScopeId: department,
            studentIds: students.map((x) => x.id),
            counselingOnly: false,
            title,
            description: 'Work occurs outside ARKST.',
            startsAt: new Date(Date.now() - 60000).toISOString(),
            deadlineAt: new Date(Date.now() + 3600000).toISOString(),
            endsAt: new Date(Date.now() + 7200000).toISOString(),
            requiresVerification: false,
          },
          'POST',
          201,
        );
        activityId = activity.id;
        assert.equal(activity.assignedCount, 6);
        activityJobs = await outboxFor('activity', activityId);
        assert.equal(activityJobs.length, 6);
        assert.deepEqual(
          activityJobs.map((x) => x.recipient_id).sort(),
          students.map((x) => x.id).sort(),
        );
        assert.equal(
          await count(
            'select count(*)::int n from public.notifications where source_id=$1',
            [activityId],
          ),
          6,
        );
        assert.equal((await api(outsider, '/api/notifications')).total, 0);
        for (const student of students)
          assert.equal((await api(student, '/api/notifications')).total, 1);
        const ownPreview = await api(
          students[0],
          `/api/notifications/${activityJobs.find((x) => x.recipient_id === students[0].id).notification_id}/push-preview`,
        );
        assert.equal(
          ownPreview.url,
          `/dashboard/student?activity=${activityId}`,
        );
        await api(
          outsider,
          `/api/notifications/${activityJobs[0].notification_id}/push-preview`,
          undefined,
          'GET',
          404,
        );
        const ownNotificationId = activityJobs.find(
          (x) => x.recipient_id === students[0].id,
        ).notification_id;
        await api(
          students[0],
          `/api/notifications/${ownNotificationId}/read`,
          {},
          'POST',
        );
        assert.equal(
          (await api(students[0], '/api/notifications/unread')).unread,
          0,
        );
        await api(
          students[0],
          `/api/notifications/${ownNotificationId}/unread`,
          {},
          'POST',
        );
        assert.equal(
          (await api(students[0], '/api/notifications/unread')).unread,
          1,
        );
        await api(
          outsider,
          `/api/notifications/${ownNotificationId}/unread`,
          {},
          'POST',
          403,
        );
      },
    );

    await check(
      'subscription APIs bind devices to real users and deny cross-account reads and writes',
      async () => {
        const first = fakeSubscription(1),
          second = fakeSubscription(2),
          other = fakeSubscription(3);
        assert.equal(
          (await api(students[0], '/api/push/subscription', first, 'POST'))
            .enabled,
          true,
        );
        assert.equal(
          (await api(students[0], '/api/push/subscription', second, 'POST'))
            .enabled,
          true,
        );
        assert.equal(
          (await api(students[1], '/api/push/subscription', other, 'POST'))
            .enabled,
          true,
        );
        assert.equal(
          (
            await api(
              students[0],
              '/api/push/subscription',
              { endpoint: first.endpoint },
              'PUT',
            )
          ).enabled,
          true,
        );
        assert.equal(
          (
            await api(
              students[1],
              '/api/push/subscription',
              { endpoint: first.endpoint },
              'PUT',
            )
          ).enabled,
          false,
        );
        await api(
          students[1],
          '/api/push/subscription',
          { endpoint: first.endpoint },
          'DELETE',
          403,
        );
        await api(students[1], '/api/push/subscription', first, 'POST', 403);
        deniedRead(
          await students[1].client.from('push_subscriptions').select('*'),
        );
        deniedWrite(
          await students[1].client
            .from('push_subscriptions')
            .update({ active: false })
            .eq('endpoint', first.endpoint),
        );
        assert.equal(
          await count(
            'select count(*)::int n from public.push_subscriptions where user_id=$1 and active',
            [students[0].id],
          ),
          2,
        );
      },
    );

    await check(
      'authenticated registration is limited to ten active devices per account',
      async () => {
        for (let i = 0; i < 10; i++)
          assert.equal(
            (
              await api(
                outsider,
                '/api/push/subscription',
                fakeSubscription(20 + i),
                'POST',
              )
            ).enabled,
            true,
          );
        await api(
          outsider,
          '/api/push/subscription',
          fakeSubscription(31),
          'POST',
          400,
        );
        await api(
          outsider,
          '/api/push/subscription',
          { endpoint: fakeSubscription(20).endpoint },
          'DELETE',
        );
        await api(
          outsider,
          '/api/push/subscription',
          fakeSubscription(31),
          'POST',
        );
        await api(
          outsider,
          '/api/push/subscription',
          fakeSubscription(20),
          'POST',
          400,
        );
        assert.equal(
          await count(
            'select count(*)::int n from public.push_subscriptions where user_id=$1 and active',
            [outsider.id],
          ),
          10,
        );
      },
    );

    await check(
      'bounded trusted dispatch sends only to stored recipient devices and is idempotent',
      async () => {
        const sent = [];
        const sender = async (subscription, id) => {
          sent.push([subscription.endpoint, id]);
          return { statusCode: 201 };
        };
        const ids = activityJobs.map((x) => x.id);
        const result = await dispatchDue({
          databaseUrl: config.databaseUrl,
          send: sender,
          outboxIds: ids,
        });
        assert.equal(result.claimed, 6);
        assert.equal(result.attempts, 3);
        assert.equal(sent.length, 3);
        const firstJob = activityJobs.find(
          (x) => x.recipient_id === students[0].id,
        );
        assert.equal(
          sent.filter((x) => x[1] === firstJob.notification_id).length,
          2,
        );
        assert.equal(
          (
            await dispatchDue({
              databaseUrl: config.databaseUrl,
              send: sender,
              outboxIds: ids,
            })
          ).claimed,
          0,
        );
        assert.equal(sent.length, 3);
        assert.equal(
          await count(
            `select count(*)::int n from public.notifications where source_id=$1`,
            [activityId],
          ),
          6,
        );
      },
    );

    await check(
      'announcement adds only informational notifications and disabled device stops attempts',
      async () => {
        const disabled = fakeSubscription(1);
        assert.equal(
          (
            await api(
              students[0],
              '/api/push/subscription',
              { endpoint: disabled.endpoint },
              'DELETE',
            )
          ).disabled,
          true,
        );
        const published = await announcement(
          teacher,
          students,
          `No tests ${tag}`,
        );
        assert.equal(published.recipientCount, 6);
        assert.equal(
          await count(
            'select count(*)::int n from public.activity_assignments where activity_id=$1',
            [published.id],
          ),
          0,
        );
        const jobs = await outboxFor('announcement', published.id);
        const sent = [];
        await dispatchDue({
          databaseUrl: config.databaseUrl,
          outboxIds: jobs.map((x) => x.id),
          send: async (sub) => {
            sent.push(sub.endpoint);
            return { statusCode: 201 };
          },
        });
        assert.equal(sent.length, 2);
        assert.ok(!sent.includes(disabled.endpoint));
        assert.equal((await api(students[0], '/api/notifications')).total, 2);
      },
    );

    await check(
      'transient 429 retries one device without resending accepted device',
      async () => {
        const published = await announcement(
          teacher,
          [students[0]],
          `Retry ${tag}`,
        );
        const [job] = await outboxFor('announcement', published.id);
        const attempts = [];
        const sender = async (sub) => {
          attempts.push(sub.endpoint);
          if (attempts.length === 1) throw { statusCode: 429 };
          return { statusCode: 201 };
        };
        await dispatchDue({
          databaseUrl: config.databaseUrl,
          outboxIds: [job.id],
          send: sender,
        });
        assert.equal(attempts.length, 1);
        assert.equal(
          await count(
            'select count(*)::int n from public.notification_outbox where id=$1 and processed_at is null',
            [job.id],
          ),
          1,
        );
        await db.query(
          `update public.push_deliveries set next_attempt_at=now()-interval '1 second' where outbox_id=$1 and state='pending'`,
          [job.id],
        );
        await db.query(
          `update public.notification_outbox set next_attempt_at=now()-interval '1 second' where id=$1`,
          [job.id],
        );
        await dispatchDue({
          databaseUrl: config.databaseUrl,
          outboxIds: [job.id],
          send: sender,
        });
        assert.equal(attempts.length, 2);
        assert.equal(
          await count(
            "select count(*)::int n from public.notification_outbox where id=$1 and outcome='accepted'",
            [job.id],
          ),
          1,
        );
      },
    );

    await check(
      'permanent 410 disables the endpoint and never retries it',
      async () => {
        const published = await announcement(
          teacher,
          [students[1]],
          `Gone ${tag}`,
        );
        const [job] = await outboxFor('announcement', published.id);
        let calls = 0;
        const sender = async () => {
          calls++;
          throw { statusCode: 410 };
        };
        await dispatchDue({
          databaseUrl: config.databaseUrl,
          outboxIds: [job.id],
          send: sender,
        });
        assert.equal(calls, 1);
        assert.equal(
          await count(
            `select count(*)::int n from public.push_subscriptions
        where user_id=$1 and active`,
            [students[1].id],
          ),
          0,
        );
        assert.equal(
          (
            await dispatchDue({
              databaseUrl: config.databaseUrl,
              outboxIds: [job.id],
              send: sender,
            })
          ).claimed,
          0,
        );
        assert.equal(calls, 1);
      },
    );

    await check(
      'two concurrent claimers cannot own one job; expired lease recovers a crash',
      async () => {
        const published = await announcement(
          teacher,
          [students[0]],
          `Crash ${tag}`,
        );
        const [job] = await outboxFor('announcement', published.id);
        const other = new pg.Client({ connectionString: config.databaseUrl });
        await other.connect();
        try {
          const claims = await Promise.all([
            claimNext(db, [job.id]),
            claimNext(other, [job.id]),
          ]);
          assert.equal(claims.filter(Boolean).length, 1);
          assert.equal(await claimNext(db, [job.id]), null);
          await db.query(
            `update public.notification_outbox set lease_until=now()-interval '1 second' where id=$1`,
            [job.id],
          );
          const recovered = await claimNext(db, [job.id]);
          assert.ok(recovered);
          await processClaim(db, recovered, async () => ({ statusCode: 201 }));
          assert.equal(
            await count(
              `select count(*)::int n from public.notification_outbox
          where id=$1 and processed_at is not null`,
              [job.id],
            ),
            1,
          );
        } finally {
          await other.end();
        }
      },
    );

    await check(
      '124 synthetic device subscriptions are processed in bounded passes without network traffic',
      async () => {
        const published = await announcement(
          teacher,
          [students[2]],
          `Fanout ${tag}`,
        );
        const [job] = await outboxFor('announcement', published.id);
        const values = [];
        for (let i = 0; i < 124; i++)
          values.push([
            students[2].id,
            fakeSubscription(100 + i).endpoint,
            'A'.repeat(87),
            'B'.repeat(22),
          ]);
        for (const row of values)
          await db.query(
            `insert into public.push_subscriptions
        (user_id,endpoint,p256dh,auth_secret) values($1,$2,$3,$4)`,
            row,
          );
        let sends = 0;
        for (let pass = 0; pass < 20; pass++) {
          const result = await dispatchDue({
            databaseUrl: config.databaseUrl,
            outboxIds: [job.id],
            send: async () => {
              sends++;
              return { statusCode: 201 };
            },
          });
          if (result.claimed === 0) break;
        }
        assert.equal(sends, 124);
        assert.equal(
          await count(
            `select count(*)::int n from public.push_deliveries
        where outbox_id=$1 and state='accepted'`,
            [job.id],
          ),
          124,
        );
        assert.equal(
          await count(
            `select count(*)::int n from public.notification_outbox
        where id=$1 and processed_at is not null`,
            [job.id],
          ),
          1,
        );
      },
    );

    await check(
      'worker rejects a malicious stored endpoint before any network request',
      async () => {
        const published = await announcement(
          teacher,
          [students[4]],
          `SSRF ${tag}`,
        );
        const [job] = await outboxFor('announcement', published.id);
        await db.query(
          `insert into public.push_subscriptions(user_id,endpoint,p256dh,auth_secret)
        values($1,$2,$3,$4)`,
          [
            students[4].id,
            `https://127.0.0.1/private/${tag}`,
            'A'.repeat(87),
            'B'.repeat(22),
          ],
        );
        let calls = 0;
        await dispatchDue({
          databaseUrl: config.databaseUrl,
          outboxIds: [job.id],
          send: async () => {
            calls++;
            return { statusCode: 201 };
          },
        });
        assert.equal(calls, 0);
        assert.equal(
          await count(
            `select count(*)::int n from public.push_deliveries
        where outbox_id=$1 and last_error_class='invalid_endpoint'`,
            [job.id],
          ),
          1,
        );
      },
    );

    await check(
      'expired device is disabled and retains only its in-app notification',
      async () => {
        const published = await announcement(
          teacher,
          [students[5]],
          `Expired ${tag}`,
        );
        const [job] = await outboxFor('announcement', published.id);
        await db.query(
          `insert into public.push_subscriptions
        (user_id,endpoint,p256dh,auth_secret,expires_at) values($1,$2,$3,$4,now()-interval '1 minute')`,
          [
            students[5].id,
            fakeSubscription(500).endpoint,
            'A'.repeat(87),
            'B'.repeat(22),
          ],
        );
        let calls = 0;
        await dispatchDue({
          databaseUrl: config.databaseUrl,
          outboxIds: [job.id],
          send: async () => {
            calls++;
            return { statusCode: 201 };
          },
        });
        assert.equal(calls, 0);
        assert.equal(
          await count(
            'select count(*)::int n from public.push_subscriptions where user_id=$1 and active',
            [students[5].id],
          ),
          0,
        );
        assert.equal((await api(students[5], '/api/notifications')).total, 3);
      },
    );

    await check(
      'open inbox reconciles new data, reload and reconnect; push browser attempt is recorded separately',
      async () => {
        const browserOptions = {
          channel:
            process.env.PUSH_BROWSER_CHANNEL === 'chrome' ? 'chrome' : 'msedge',
          headless: process.env.PUSH_EDGE_HEADED !== '1',
        };
        const profileDirectory =
          process.env.PUSH_PERSISTENT_PROFILE === '1'
            ? await mkdtemp(path.join(tmpdir(), 'arkst-push-profile-'))
            : null;
        const context = profileDirectory
          ? await chromium.launchPersistentContext(profileDirectory, {
              ...browserOptions,
              permissions: ['notifications'],
            })
          : await (async () => {
              browser = await chromium.launch(browserOptions);
              return browser.newContext({ permissions: ['notifications'] });
            })();
        if (profileDirectory) browser = context;
        const page = await context.newPage();
        await page.goto(`${config.appOrigin}/login`);
        await page.getByLabel('Email').fill(students[3].email);
        await page.getByLabel('Password').fill(students[3].password);
        await page
          .getByRole('button', { name: 'Sign in to local Supabase' })
          .click();
        await expect(page).toHaveURL(`${config.appOrigin}/profile`);
        await page.goto(`${config.appOrigin}/dashboard/notifications`);
        const browserIdentity = await page.evaluate(async () =>
          (await fetch('/api/me', { cache: 'no-store' })).json(),
        );
        assert.equal(browserIdentity.profile.id, students[3].id);
        await expect(page.getByText(`Push six ${tag}`)).toBeVisible();
        const live = await announcement(
          teacher,
          [students[3]],
          `Open inbox ${tag}`,
        );
        await expect(page.getByText(`Open inbox ${tag}`)).toBeVisible({
          timeout: 25000,
        });
        await page.reload();
        await expect(page.getByText(`Open inbox ${tag}`)).toBeVisible();
        await context.setOffline(true);
        const missed = await announcement(
          teacher,
          [students[3]],
          `Reconnected ${tag}`,
        );
        await context.setOffline(false);
        await page.evaluate(() => window.dispatchEvent(new Event('online')));
        await expect(page.getByText(`Reconnected ${tag}`)).toBeVisible({
          timeout: 25000,
        });
        assert.notEqual(live.id, missed.id);
        // Attempt a real PushManager subscription and provider send. Headless Edge
        // or the local network may reject FCM; record this separately, never fake it.
        try {
          if (process.env.PUSH_BROWSER_DIAGNOSTIC === '1') {
            await page.evaluate(() => {
              const attempts = [];
              window.__arkstPushDiagnostic = attempts;
              const original = PushManager.prototype.subscribe;
              PushManager.prototype.subscribe = async function (options) {
                const entry = {
                  activation: navigator.userActivation?.isActive ?? null,
                  notificationPermission: Notification.permission,
                  keyBytes: options?.applicationServerKey?.byteLength ?? null,
                  userVisibleOnly: options?.userVisibleOnly ?? null,
                };
                attempts.push(entry);
                try {
                  const result = await original.call(this, options);
                  entry.result = 'subscription returned';
                  return result;
                } catch (error) {
                  entry.error = `${error.name}: ${error.message}`;
                  throw error;
                }
              };
            });
          }
          const pushResponses = [];
          page.on('response', (response) => {
            if (new URL(response.url()).pathname.startsWith('/api/push/'))
              pushResponses.push(
                `${response.request().method()}:${response.status()}`,
              );
          });
          await page
            .getByRole('button', { name: 'Enable desktop notifications' })
            .click();
          if (process.env.PUSH_BROWSER_DIAGNOSTIC === '1') {
            await page.waitForFunction(
              () =>
                !document.querySelector(
                  'section[aria-label="Desktop notifications"] button:disabled',
                ),
              null,
              { timeout: 90000 },
            );
            const diagnostic = await page.evaluate(async () => {
              const registration =
                await navigator.serviceWorker.getRegistration('/');
              const response = await fetch('/api/push/config');
              const config = response.ok ? await response.json() : null;
              const publicKey = config?.publicKey ?? '';
              const key = publicKey
                ? Uint8Array.from(
                    atob(publicKey.replace(/-/g, '+').replace(/_/g, '/')),
                    (character) => character.charCodeAt(0),
                  )
                : null;
              let pushPermission = 'unavailable';
              try {
                pushPermission = registration
                  ? await registration.pushManager.permissionState({
                      userVisibleOnly: true,
                      applicationServerKey: key,
                    })
                  : 'no registration';
              } catch (error) {
                pushPermission = `${error.name}: ${error.message}`;
              }
              return {
                origin: location.origin,
                secure: isSecureContext,
                notificationPermission: Notification.permission,
                browserPermission: (
                  await navigator.permissions.query({ name: 'notifications' })
                ).state,
                workerScope: registration?.scope ?? null,
                workerState: registration?.active?.state ?? null,
                keyBytes: key?.byteLength ?? null,
                keyPrefixValid: key?.[0] === 4,
                pushPermission,
                attempts: window.__arkstPushDiagnostic,
              };
            });
            console.log(
              'REAL PUSH BROWSER DIAGNOSTIC:',
              JSON.stringify(diagnostic),
            );
          }
          await expect(
            page
              .locator('section[aria-label="Desktop notifications"]')
              .getByText(/^Enabled on this browser\./),
          ).toBeVisible({ timeout: 15000 });
          const {
            rows: [browserSubscription],
          } = await db.query(
            `select count(*)::integer active_count from public.push_subscriptions
              where user_id=$1 and active`,
            [students[3].id],
          );
          if (browserSubscription.active_count !== 1) {
            const browserEndpoint = await page.evaluate(
              async () =>
                (
                  await (
                    await navigator.serviceWorker.getRegistration('/')
                  )?.pushManager.getSubscription()
                )?.endpoint ?? null,
            );
            const { rows: matching } = browserEndpoint
              ? await db.query(
                  'select user_id,active from public.push_subscriptions where endpoint=$1',
                  [browserEndpoint],
                )
              : { rows: [] };
            const { rows: owners } = await db.query(
              `select user_id,count(*)::integer n from public.push_subscriptions
                where user_id=any($1::uuid[]) and active group by user_id`,
              [students.map((x) => x.id)],
            );
            console.log(
              'REAL PUSH DIAGNOSTIC: active subscription counts by fixture student:',
              owners
                .map(
                  (row) =>
                    `${students.findIndex((x) => x.id === row.user_id) + 1}:${row.n}`,
                )
                .join(','),
            );
            console.log(
              'REAL PUSH DIAGNOSTIC: endpoint stored:',
              matching.length,
              'owner fixture:',
              matching.length
                ? students.findIndex((x) => x.id === matching[0].user_id) + 1
                : 0,
              'active:',
              matching[0]?.active ?? false,
              'API responses:',
              pushResponses.join(','),
            );
          }
          assert.equal(
            browserSubscription.active_count,
            1,
            `The real browser subscription must be stored before dispatch (found ${browserSubscription.active_count}).`,
          );
          const published = await announcement(
            teacher,
            [students[3]],
            `Real push ${tag}`,
          );
          const [job] = await outboxFor('announcement', published.id);
          const sender = createWebPushSender({
            publicKey: process.env.PUSH_VAPID_PUBLIC_KEY,
            privateKey: process.env.PUSH_VAPID_PRIVATE_KEY,
            subject: process.env.PUSH_VAPID_SUBJECT,
          });
          const result = await dispatchDue({
            databaseUrl: config.databaseUrl,
            outboxIds: [job.id],
            send: sender,
          });
          const {
            rows: [delivery],
          } = await db.query(
            `select state,last_status,last_error_class
          from public.push_deliveries where outbox_id=$1`,
            [job.id],
          );
          if (result.attempts > 0 && delivery?.state === 'accepted') {
            console.log(
              'REAL PUSH PROVIDER ACCEPTED: browser subscription received a 2xx response.',
            );
            // A headless browser does not prove an OS desktop popup was shown.
            console.log(
              'REAL OS POPUP UNVERIFIED: headless Edge cannot establish visible desktop presentation.',
            );
          } else
            console.log(
              `REAL PUSH UNVERIFIED: ${result.claimed} jobs claimed, ${result.attempts} provider attempts; ${delivery?.last_error_class ?? 'no delivery'}.`,
            );
        } catch (error) {
          const statusText = await page
            .locator('section[aria-label="Desktop notifications"]')
            .textContent()
            .catch(() => 'Browser status unavailable');
          console.log(
            `REAL PUSH UNVERIFIED: ${error?.name ?? 'browser or provider failure'}; browser status: ${statusText?.slice(0, 220) ?? 'unavailable'}.`,
          );
        }
        await context.close();
        if (profileDirectory) await rm(profileDirectory, { recursive: true });
      },
    );

    await check(
      'endpoint validation and retry classification reject unsafe destinations and bound backoff',
      async () => {
        assert.equal(classifyPushFailure({ statusCode: 410 }).disable, true);
        assert.equal(classifyPushFailure({ statusCode: 429 }).terminal, false);
        assert.equal(retryDelaySeconds(20), 3600);
        const bad = fakeSubscription(1000);
        bad.endpoint = 'https://127.0.0.1/private';
        await api(students[0], '/api/push/subscription', bad, 'POST', 400);
        await api(
          students[0],
          '/api/push/subscription',
          {
            ...bad,
            endpoint: 'https://fcm.googleapis.com.evil.test/fcm/send/x',
          },
          'POST',
          400,
        );
        assert.equal(
          (await new AppBrowser(config.appOrigin).request('/api/push/config'))
            .status,
          401,
        );
      },
    );
  } catch (error) {
    failure = error;
  } finally {
    if (browser)
      try {
        await browser.close();
      } catch (error) {
        cleanupErrors.push(`browser: ${error.message}`);
      }
    if (connected)
      try {
        const allIds = users.map((x) => x.id);
        await db.query(
          'delete from public.announcements where created_by=any($1::uuid[])',
          [allIds],
        );
        await db.query(
          'delete from public.activities where created_by=any($1::uuid[])',
          [allIds],
        );
        await db.query(
          'delete from public.department_student_roster where department_scope_id=$1',
          [department],
        );
        await db.query(
          'delete from public.student_scope_memberships where scope_id=$1',
          [section],
        );
        await db.query(
          'delete from public.activity_capabilities where responsibility_id=$1',
          [responsibility?.id],
        );
        await db.query(
          'delete from public.responsibility_assignments where user_id=any($1::uuid[])',
          [allIds],
        );
      } catch (error) {
        cleanupErrors.push(`database fixture: ${error.message}`);
      }
    for (const person of users.toReversed())
      try {
        noDatabaseError(
          await admin.auth.admin.deleteUser(person.id),
          'remove synthetic Auth user',
        );
      } catch (error) {
        cleanupErrors.push(`Auth ${person.id}: ${error.message}`);
      }
    if (connected) {
      try {
        await db.query('delete from public.scopes where id=$1', [section]);
        await db.query('delete from public.scopes where id=$1', [department]);
        assert.equal(
          await count(
            'select count(*)::int n from public.profiles where id=any($1::uuid[])',
            [users.map((x) => x.id)],
          ),
          0,
        );
      } catch (error) {
        cleanupErrors.push(`scopes: ${error.message}`);
      }
      await db.end();
    }
  }
  if (failure || cleanupErrors.length) {
    console.error(
      `FAILED after ${passed} push groups: ${failure?.stack ?? 'cleanup failure'}`,
    );
    for (const error of cleanupErrors)
      console.error(`CLEANUP REQUIRED: ${error}`);
    process.exitCode = 1;
  } else
    console.log(
      `PASS: ${passed} real push foundation groups; browser/provider result above; synthetic fixtures removed.`,
    );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
