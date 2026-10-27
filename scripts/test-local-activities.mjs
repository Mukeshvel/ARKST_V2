import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import {
  AppBrowser,
  deniedRead,
  deniedWrite,
  localFetch,
  localTestConfiguration,
  noDatabaseError,
} from '../tests/integration/local-helpers.mjs';

async function main() {
  const config = localTestConfiguration(process.env);
  const runId = randomBytes(8).toString('hex');
  const options = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch: localFetch(config.supabaseOrigin) },
  };
  const admin = createClient(config.supabaseOrigin, config.serviceKey, options);
  const anonymous = createClient(
    config.supabaseOrigin,
    config.publicKey,
    options,
  );
  const db = new pg.Client({
    connectionString: config.databaseUrl,
    connectionTimeoutMillis: 5000,
    query_timeout: 10000,
  });
  const accounts = [];
  const scopes = [randomUUID(), randomUUID()];
  const schema = `activity_test_${runId}`;
  const trigger = `activity_failure_${runId}`;
  const policy = `activity_read_failure_${runId}`;
  let connected = false;
  let failureInstalled = false;
  let readFailureInstalled = false;
  let passed = 0;
  let failure;
  const cleanupErrors = [];

  async function check(label, action) {
    await action();
    console.log(`PASS ${++passed}: ${label}`);
  }
  async function account(label, kind) {
    const user = {
      email: `arkst-activity-${runId}-${label}@example.test`,
      password: `T!${randomBytes(24).toString('base64url')}`,
    };
    user.id = noDatabaseError(
      await admin.auth.admin.createUser({ ...user, email_confirm: true }),
      'create Auth user',
    ).user.id;
    accounts.push(user);
    noDatabaseError(
      await admin.from('profiles').insert({
        id: user.id,
        display_name: `Isolated ${label}`,
        account_kind: kind,
        staff_classification: kind === 'staff' ? 'non_teaching' : null,
        is_active: true,
      }),
      'provision profile',
    );
    user.client = createClient(
      config.supabaseOrigin,
      config.publicKey,
      options,
    );
    noDatabaseError(
      await user.client.auth.signInWithPassword({
        email: user.email,
        password: user.password,
      }),
      'real Auth sign-in',
    );
    user.browser = new AppBrowser(config.appOrigin);
    await user.browser.login(user);
    return user;
  }
  async function role(user, role, scope, capability) {
    const r = noDatabaseError(
      await admin
        .from('responsibility_assignments')
        .insert({
          user_id: user.id,
          role,
          scope_id: scope,
          starts_at: new Date(Date.now() - 86400000).toISOString(),
        })
        .select('id')
        .single(),
      'provision responsibility',
    );
    if (capability)
      noDatabaseError(
        await admin
          .from('activity_capabilities')
          .insert({ responsibility_id: r.id, ...capability }),
        'provision explicit capability',
      );
    return r.id;
  }
  function input(students, extra = {}) {
    return {
      category: 'general',
      scopeId: scopes[0],
      title: `Activity ${runId}`,
      description: 'Persisted isolated integration task',
      startsAt: new Date(Date.now() - 3600000).toISOString(),
      deadlineAt: new Date(Date.now() + 3600000).toISOString(),
      endsAt: new Date(Date.now() + 7200000).toISOString(),
      requiresVerification: false,
      studentIds: students.map((s) => s.id),
      ...extra,
    };
  }
  function rpc(data) {
    return {
      p_category: data.category,
      p_scope: data.scopeId,
      p_title: data.title,
      p_description: data.description,
      p_starts_at: data.startsAt,
      p_deadline_at: data.deadlineAt,
      p_ends_at: data.endsAt,
      p_requires_verification: data.requiresVerification,
      p_students: data.studentIds,
    };
  }
  async function post(user, path, data = {}, expected = 200) {
    const response = await user.browser.request(path, {
      method: 'POST',
      headers: { Origin: config.appOrigin, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    assert.equal(
      response.status,
      expected,
      `${path}: ${await response.clone().text()}`,
    );
    assert.match(response.headers.get('cache-control') ?? '', /no-store/);
    return response.json();
  }
  async function create(user, data) {
    return (await post(user, '/api/activities', data, 201)).id;
  }
  async function detail(user, id) {
    const response = await user.browser.request(`/api/activities/${id}`);
    assert.equal(response.status, 200);
    return (await response.json()).activity;
  }
  async function assignment(activity, student) {
    return (
      await db.query(
        'select id from public.activity_assignments where activity_id=$1 and student_id=$2',
        [activity, student.id],
      )
    ).rows[0].id;
  }
  async function removeFailures() {
    if (readFailureInstalled) {
      await db.query(
        `drop policy "${policy}" on public.activities; drop function "${schema}".fail_read();`,
      );
      readFailureInstalled = false;
    }
    if (failureInstalled) {
      await db.query(
        `drop trigger "${trigger}" on public.activity_history; drop function "${schema}".fail_write(); drop schema "${schema}";`,
      );
      failureInstalled = false;
    }
  }

  try {
    await db.connect();
    connected = true;
    await db.query('select 1 from public.activity_completions limit 0');
    noDatabaseError(
      await admin.from('scopes').insert({
        id: scopes[0],
        kind: 'department',
        name: `Activity department ${runId}`,
      }),
      'create department',
    );
    noDatabaseError(
      await admin.from('scopes').insert({
        id: scopes[1],
        kind: 'section',
        parent_id: scopes[0],
        name: `Activity section ${runId}`,
      }),
      'create section',
    );
    const a = await account('student-a', 'student');
    const b = await account('student-b', 'student');
    const c = await account('student-other-section', 'student');
    const staff = await account('staff-a', 'staff');
    const other = await account('staff-b', 'staff');
    const reviewer = await account('reviewer', 'staff');
    const noGrant = await account('admin-without-capability', 'staff');
    noDatabaseError(
      await admin.from('student_scope_memberships').insert([
        { student_id: a.id, scope_id: scopes[0] },
        { student_id: b.id, scope_id: scopes[0] },
        { student_id: c.id, scope_id: scopes[1] },
      ]),
      'provision exact memberships',
    );
    const staffRole = await role(staff, 'teacher', scopes[0], {
      category_key: 'general',
      can_create: true,
    });
    await role(staff, 'counselor', scopes[1], {
      category_key: 'placement',
      can_verify: true,
    });
    await role(other, 'coordinator', scopes[1], {
      category_key: 'general',
      can_create: true,
      can_verify: true,
    });
    await role(reviewer, 'counselor', scopes[0], {
      category_key: 'general',
      can_verify: true,
    });
    await role(noGrant, 'admin', scopes[0]);
    let shared;
    let otherActivity;
    let aAssignment;
    let bAssignment;
    await check(
      'authorized staff creates a persisted activity, direct assignments and actor history atomically',
      async () => {
        shared = await create(staff, input([a, b]));
        otherActivity = await create(other, input([c], { scopeId: scopes[1] }));
        await create(staff, input([b]));
        const row = await detail(staff, shared);
        assert.equal(row.created_by, staff.id);
        assert.equal(row.assignments.length, 2);
        assert.ok(row.assignments.every((x) => x.completion === null));
        aAssignment = await assignment(shared, a);
        bAssignment = await assignment(shared, b);
        const audit = (
          await db.query(
            'select * from public.activity_history where activity_id=$1 order by id',
            [shared],
          )
        ).rows;
        assert.deepEqual(audit.map((x) => x.action).sort(), [
          'assigned',
          'assigned',
          'created',
        ]);
        assert.ok(
          audit.every(
            (x) => x.actor_id === staff.id && x.occurred_at instanceof Date,
          ),
        );
      },
    );
    await check(
      'anonymous, student, role-only admin and verify-only staff cannot create',
      async () => {
        const anon = new AppBrowser(config.appOrigin);
        assert.equal((await anon.request('/api/activities')).status, 401);
        await post({ browser: anon }, '/api/activities', input([a]), 401);
        deniedRead(await anonymous.from('activities').select('*'));
        deniedWrite(await anonymous.rpc('create_activity', rpc(input([a]))));
        for (const user of [a, noGrant, reviewer]) {
          await post(user, '/api/activities', input([a]), 403);
          deniedWrite(
            await user.client.rpc('create_activity', rpc(input([a]))),
          );
        }
      },
    );
    await check(
      'every target, category and exact scope is checked without hierarchy or combined-role escalation',
      async () => {
        const before = (
          await db.query(
            'select count(*)::int as n from public.activities where created_by=$1',
            [staff.id],
          )
        ).rows[0].n;
        for (const data of [
          input([a, c]),
          input([c], { scopeId: scopes[1] }),
          input([a], { category: 'placement' }),
        ]) {
          await post(staff, '/api/activities', data, 403);
          deniedWrite(await staff.client.rpc('create_activity', rpc(data)));
        }
        assert.equal(
          (
            await db.query(
              'select count(*)::int as n from public.activities where created_by=$1',
              [staff.id],
            )
          ).rows[0].n,
          before,
        );
        deniedRead(
          await staff.client.from('profiles').select('*').eq('id', a.id),
        );
      },
    );
    await check(
      'students see only assigned activities and their own assignment/completion/history rows',
      async () => {
        const response = await a.browser.request('/api/activities');
        assert.equal(response.status, 200);
        const rows = (await response.json()).activities;
        assert.deepEqual(
          rows.map((x) => x.id),
          [shared],
        );
        assert.deepEqual(
          rows[0].assignments.map((x) => x.student_id),
          [a.id],
        );
        deniedRead(
          await a.client.from('activities').select('*').eq('id', otherActivity),
        );
        deniedRead(
          await a.client
            .from('activity_assignments')
            .select('*')
            .eq('id', bAssignment),
        );
        assert.equal(
          (await a.browser.request(`/api/activities/${otherActivity}`)).status,
          404,
        );
        const history = await a.browser.request(
          `/api/activities/${shared}/history`,
        );
        assert.equal(history.status, 200);
        assert.ok(
          (await history.json()).history.every(
            (x) => x.assignment_id === aAssignment,
          ),
        );
      },
    );
    await check(
      'staff cannot read or verify activities outside their approved scope/category',
      async () => {
        assert.equal(
          (await staff.browser.request(`/api/activities/${otherActivity}`))
            .status,
          404,
        );
        deniedRead(
          await staff.client
            .from('activities')
            .select('*')
            .eq('id', otherActivity),
        );
        const target = await assignment(otherActivity, c);
        deniedRead(
          await staff.client
            .from('activity_assignments')
            .select('*')
            .eq('id', target),
        );
        await post(
          staff,
          `/api/activity-assignments/${target}/verify`,
          {},
          403,
        );
        await post(
          other,
          `/api/activity-assignments/${aAssignment}/verify`,
          {},
          403,
        );
      },
    );
    await check(
      'student cannot submit another assignment, forge actor/state, or write tables directly',
      async () => {
        await post(
          a,
          `/api/activity-assignments/${bAssignment}/submit`,
          {},
          403,
        );
        deniedWrite(
          await a.client.rpc('submit_activity', { p_assignment: bAssignment }),
        );
        await post(
          staff,
          `/api/activity-assignments/${aAssignment}/submit`,
          {},
          403,
        );
        await post(
          a,
          `/api/activity-assignments/${aAssignment}/submit`,
          { state: 'verified', submitted_by: b.id },
          400,
        );
        deniedWrite(
          await a.client.from('activity_completions').insert({
            assignment_id: aAssignment,
            state: 'verified',
            submitted_by: a.id,
          }),
        );
        for (const table of [
          'activities',
          'activity_assignments',
          'activity_completions',
          'activity_history',
          'activity_capabilities',
          'student_scope_memberships',
        ]) {
          deniedWrite(
            await staff.client
              .from(table)
              .delete()
              .not(
                table === 'activity_completions'
                  ? 'assignment_id'
                  : table === 'activity_capabilities'
                    ? 'responsibility_id'
                    : 'id',
                'is',
                null,
              ),
          );
        }
        deniedWrite(
          await staff.client.from('activity_capabilities').insert({
            responsibility_id: staffRole,
            category_key: 'placement',
            can_create: true,
          }),
        );
      },
    );
    await check(
      'completion persists across a fresh authenticated read and duplicate requests create one report/event',
      async () => {
        const path = `/api/activity-assignments/${aAssignment}/submit`;
        const results = await Promise.all(
          [0, 1].map(() =>
            a.browser.request(path, {
              method: 'POST',
              headers: {
                Origin: config.appOrigin,
                'Content-Type': 'application/json',
              },
              body: '{}',
            }),
          ),
        );
        assert.deepEqual(results.map((x) => x.status).sort(), [200, 409]);
        const fresh = new AppBrowser(config.appOrigin);
        await fresh.login(a);
        const persisted = await detail({ browser: fresh }, shared);
        assert.equal(persisted.assignments[0].completion.state, 'reported');
        assert.equal(persisted.assignments[0].completion.submitted_by, a.id);
        assert.equal(persisted.requires_verification, false);
        assert.equal(
          (
            await db.query(
              'select count(*)::int as n from public.activity_completions where assignment_id=$1',
              [aAssignment],
            )
          ).rows[0].n,
          1,
        );
        assert.equal(
          (
            await db.query(
              "select count(*)::int as n from public.activity_history where assignment_id=$1 and action='reported'",
              [aAssignment],
            )
          ).rows[0].n,
          1,
        );
        assert.equal(
          (await a.client.rpc('submit_activity', { p_assignment: aAssignment }))
            .error?.code,
          '23505',
        );
        deniedRead(
          await b.client
            .from('activity_completions')
            .select('*')
            .eq('assignment_id', aAssignment),
        );
      },
    );
    await check(
      'required verification stays reported until an explicitly authorized reviewer verifies once',
      async () => {
        const activity = await create(
          staff,
          input([a], { requiresVerification: true }),
        );
        const id = await assignment(activity, a);
        await post(reviewer, `/api/activity-assignments/${id}/verify`, {}, 409);
        await post(a, `/api/activity-assignments/${id}/submit`);
        const pending = (await detail(a, activity)).assignments[0].completion;
        assert.equal(pending.state, 'reported');
        assert.equal(pending.verified_by, null);
        assert.equal(pending.verified_at, null);
        await post(a, `/api/activity-assignments/${id}/verify`, {}, 403);
        await post(staff, `/api/activity-assignments/${id}/verify`, {}, 403);
        deniedWrite(
          await staff.client.rpc('verify_activity', { p_assignment: id }),
        );
        const result = await post(
          reviewer,
          `/api/activity-assignments/${id}/verify`,
        );
        assert.equal(result.completion.state, 'verified');
        assert.equal(result.completion.verified_by, reviewer.id);
        assert.ok(
          Date.parse(result.completion.verified_at) >=
            Date.parse(result.completion.submitted_at),
        );
        assert.equal(
          (await detail(a, activity)).assignments[0].completion.state,
          'verified',
        );
        await post(reviewer, `/api/activity-assignments/${id}/verify`, {}, 409);
        await post(a, `/api/activity-assignments/${id}/submit`, {}, 409);
        await post(
          reviewer,
          `/api/activity-assignments/${aAssignment}/verify`,
          {},
          400,
        );
        const audit = (
          await db.query(
            'select action, actor_id from public.activity_history where assignment_id=$1 order by id',
            [id],
          )
        ).rows;
        assert.deepEqual(audit, [
          { action: 'assigned', actor_id: staff.id },
          { action: 'reported', actor_id: a.id },
          { action: 'verified', actor_id: reviewer.id },
        ]);
      },
    );
    await check(
      'invalid dates, duplicate targets, oversized and forged requests fail with accurate status',
      async () => {
        for (const change of [
          { startsAt: '2026-02-30T10:00:00Z' },
          { endsAt: '2000-01-01T00:00:00Z' },
          { studentIds: [a.id, a.id] },
          { studentIds: [] },
          { title: '' },
          { requiresVerification: 'true' },
          { groupIds: [scopes[0]] },
          { created_by: noGrant.id },
          { studentIds: ['not-a-uuid'] },
        ])
          await post(staff, '/api/activities', input([a], change), 400);
        const badSql = await staff.client.rpc(
          'create_activity',
          rpc(input([a], { deadlineAt: 'infinity' })),
        );
        assert.equal(badSql.error?.code, '22023');
        assert.equal(
          (await staff.client.rpc('create_activity', rpc(input([a, a])))).error
            ?.code,
          '22023',
        );
        assert.equal(
          (
            await staff.browser.request('/api/activities', {
              method: 'POST',
              headers: {
                Origin: config.appOrigin,
                'Content-Type': 'application/json',
              },
              body: '{',
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await staff.browser.request('/api/activities', {
              method: 'POST',
              headers: {
                Origin: config.appOrigin,
                'Content-Type': 'text/plain',
              },
              body: '{}',
            })
          ).status,
          415,
        );
        await post(staff, '/api/activities', { large: 'x'.repeat(65536) }, 413);
        assert.equal(
          (await a.browser.request('/api/activities/not-a-uuid')).status,
          400,
        );
        assert.equal(
          (await a.browser.request(`/api/activities?studentId=${b.id}`)).status,
          400,
        );
      },
    );
    await check(
      'upcoming and expired windows reject submissions using PostgreSQL time',
      async () => {
        const future = await create(
          staff,
          input([a], {
            startsAt: new Date(Date.now() + 1800000).toISOString(),
          }),
        );
        const id = await assignment(future, a);
        await post(a, `/api/activity-assignments/${id}/submit`, {}, 400);
        assert.equal(
          (await a.client.rpc('submit_activity', { p_assignment: id })).error
            ?.code,
          '22023',
        );
        await db.query(
          "update public.activities set starts_at=now()-interval '2 days', deadline_at=now()-interval '1 day', ends_at=now()+interval '1 day' where id=$1",
          [future],
        );
        await post(a, `/api/activity-assignments/${id}/submit`, {}, 400);
        assert.equal(
          (
            await db.query(
              'select count(*)::int as n from public.activity_completions where assignment_id=$1',
              [id],
            )
          ).rows[0].n,
          0,
        );
      },
    );
    await check(
      'CSRF checks reject activity creation, submission and verification',
      async () => {
        for (const path of [
          '/api/activities',
          `/api/activity-assignments/${bAssignment}/submit`,
          `/api/activity-assignments/${bAssignment}/verify`,
        ]) {
          for (const headers of [
            {},
            { Origin: 'https://untrusted.invalid' },
            { Origin: config.appOrigin, 'Sec-Fetch-Site': 'cross-site' },
          ]) {
            const response = await staff.browser.request(path, {
              method: 'POST',
              headers: { ...headers, 'Content-Type': 'application/json' },
              body: '{}',
            });
            assert.equal(response.status, 403);
          }
        }
      },
    );
    await check(
      'expired responsibilities, inactive accounts and expired memberships revoke relevant authority',
      async () => {
        await db.query(
          'update public.responsibility_assignments set ends_at=now() where id=$1',
          [staffRole],
        );
        await post(staff, '/api/activities', input([a]), 403);
        assert.equal(
          (await staff.browser.request(`/api/activities/${shared}`)).status,
          404,
        );
        deniedRead(
          await staff.client.from('activities').select('*').eq('id', shared),
        );
        await db.query(
          'update public.responsibility_assignments set ends_at=null where id=$1',
          [staffRole],
        );
        await db.query(
          'update public.profiles set is_active=false where id=$1',
          [a.id],
        );
        assert.equal((await a.browser.request('/api/activities')).status, 403);
        deniedRead(await a.client.from('activities').select('*'));
        deniedWrite(
          await a.client.rpc('submit_activity', { p_assignment: aAssignment }),
        );
        await post(staff, '/api/activities', input([a]), 403);
        await db.query(
          'update public.profiles set is_active=true where id=$1',
          [a.id],
        );
        await db.query(
          "update public.student_scope_memberships set starts_at=now()-interval '2 days', ends_at=now()-interval '1 day' where student_id=$1",
          [a.id],
        );
        await post(staff, '/api/activities', input([a]), 403);
        // Previously assigned obligations persist; membership is checked at publication.
        assert.equal(
          (await a.browser.request(`/api/activities/${shared}`)).status,
          200,
        );
        await db.query(
          'update public.student_scope_memberships set ends_at=null where student_id=$1',
          [a.id],
        );
      },
    );
    await check(
      'database history failure returns 503 and rolls back both publication and completion',
      async () => {
        // Identifiers are crypto-generated hex. Only fixture actors are affected.
        await db.query(`begin; create schema "${schema}";
        create function "${schema}".fail_write() returns trigger language plpgsql set search_path='' as $fn$
        begin if new.actor_id in ('${staff.id}'::uuid, '${b.id}'::uuid) then raise exception 'isolated audit failure' using errcode='58000'; end if; return new; end; $fn$;
        revoke all on function "${schema}".fail_write() from public, anon, authenticated;
        create trigger "${trigger}" before insert on public.activity_history for each row execute function "${schema}".fail_write(); commit;`);
        failureInstalled = true;
        const before = (
          await db.query(
            'select count(*)::int as n from public.activities where created_by=$1',
            [staff.id],
          )
        ).rows[0].n;
        await post(staff, '/api/activities', input([a]), 503);
        assert.equal(
          (
            await db.query(
              'select count(*)::int as n from public.activities where created_by=$1',
              [staff.id],
            )
          ).rows[0].n,
          before,
        );
        await post(
          b,
          `/api/activity-assignments/${bAssignment}/submit`,
          {},
          503,
        );
        assert.equal(
          (
            await db.query(
              'select count(*)::int as n from public.activity_completions where assignment_id=$1',
              [bAssignment],
            )
          ).rows[0].n,
          0,
        );
      },
    );
    await check(
      'database read failure is visible as 503, then read and writes recover',
      async () => {
        await db.query(`begin; create function "${schema}".fail_read() returns boolean language plpgsql volatile set search_path='' as $fn$
        begin if auth.uid()='${a.id}'::uuid then raise exception 'isolated activity read failure' using errcode='58000'; end if; return true; end; $fn$;
        revoke all on function "${schema}".fail_read() from public;
        grant usage on schema "${schema}" to authenticated; grant execute on function "${schema}".fail_read() to authenticated;
        create policy "${policy}" on public.activities as restrictive for select to authenticated using ("${schema}".fail_read()); commit;`);
        readFailureInstalled = true;
        const response = await a.browser.request('/api/activities');
        assert.equal(response.status, 503);
        assert.equal((await response.json()).activities, undefined);
        await removeFailures();
        assert.equal((await a.browser.request('/api/activities')).status, 200);
        await post(b, `/api/activity-assignments/${bAssignment}/submit`);
        await create(staff, input([a]));
      },
    );
    await check(
      'category extension uses the same model and needs a separate explicit capability',
      async () => {
        const category = `test_${runId}`;
        noDatabaseError(
          await admin
            .from('activity_categories')
            .insert({ key: category, label: 'Isolated extension' }),
          'extend category',
        );
        await post(staff, '/api/activities', input([a], { category }), 403);
        noDatabaseError(
          await admin.from('activity_capabilities').insert({
            responsibility_id: staffRole,
            category_key: category,
            can_create: true,
          }),
          'grant extended category',
        );
        const id = await create(staff, input([a], { category }));
        assert.equal((await detail(a, id)).category_key, category);
      },
    );
    await check(
      'pagination returns visible persisted rows and does not accept arbitrary user selectors',
      async () => {
        assert.equal(
          (await a.browser.request('/api/activities?offset=0')).status,
          200,
        );
        const tail = await a.browser.request('/api/activities?offset=500');
        assert.equal(tail.status, 200);
        assert.deepEqual((await tail.json()).activities, []);
        const history = await a.browser.request(
          `/api/activities/${shared}/history?offset=500`,
        );
        assert.deepEqual((await history.json()).history, []);
        assert.equal(
          (await a.browser.request('/api/activities?offset=-1')).status,
          400,
        );
      },
    );
  } catch (error) {
    failure = error;
  } finally {
    if (connected) {
      try {
        await db.query('rollback');
        await removeFailures();
      } catch (error) {
        cleanupErrors.push(`failure hooks: ${error.message}`);
      }
      try {
        await db.query(
          'delete from public.activities where scope_id=any($1::uuid[])',
          [scopes],
        );
        await db.query(
          'delete from public.student_scope_memberships where scope_id=any($1::uuid[])',
          [scopes],
        );
      } catch (error) {
        cleanupErrors.push(`activity fixtures: ${error.message}`);
      }
    }
    for (const user of accounts.toReversed()) {
      try {
        noDatabaseError(
          await admin.auth.admin.deleteUser(user.id),
          'delete generated user',
        );
      } catch (error) {
        cleanupErrors.push(`user ${user.id}: ${error.message}`);
      }
    }
    if (connected) {
      try {
        await db.query('delete from public.scopes where id=$1', [scopes[1]]);
        await db.query('delete from public.scopes where id=$1', [scopes[0]]);
        await db.query('delete from public.activity_categories where key=$1', [
          `test_${runId}`,
        ]);
        const leftovers = await db.query(
          'select count(*)::int as n from public.profiles where id=any($1::uuid[])',
          [accounts.map((a) => a.id)],
        );
        assert.equal(leftovers.rows[0].n, 0);
      } catch (error) {
        cleanupErrors.push(`scope/category cleanup: ${error.message}`);
      }
      await db.end();
    }
  }
  if (failure || cleanupErrors.length) {
    console.error(
      `FAILED after ${passed} groups: ${failure?.message ?? 'cleanup failed'}`,
    );
    for (const issue of cleanupErrors)
      console.error(`CLEANUP REQUIRED: ${issue}`);
    if (failureInstalled || readFailureInstalled)
      console.error(
        `Inspect isolated failure hooks ${trigger}, ${policy}, schema ${schema}.`,
      );
    process.exitCode = 1;
  } else
    console.log(
      `PASS: ${passed} real Activity Auth/HTTP/PostgreSQL/RLS groups; test accounts, records and failure hooks removed.`,
    );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
