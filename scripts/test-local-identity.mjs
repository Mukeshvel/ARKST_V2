import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import {
  AppBrowser,
  localTestConfiguration,
  localFetch,
  noDatabaseError,
  deniedRead,
  deniedWrite,
} from '../tests/integration/local-helpers.mjs';

// Intentionally fails (never skip-passes) if a real isolated local stack is absent.
async function main() {
  const config = localTestConfiguration(process.env);
  const [{ createClient }, { default: pg }] = await Promise.all([
    import('@supabase/supabase-js'),
    import('pg'),
  ]);
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
  const database = new pg.Client({
    connectionString: config.databaseUrl,
    connectionTimeoutMillis: 5_000,
    query_timeout: 10_000,
  });
  const runId = randomBytes(8).toString('hex');
  const schema = `identity_test_${runId}`;
  const policy = `identity_failure_${runId}`;
  const scopeId = randomUUID();
  const accounts = [];
  let connected = false;
  let scopeCreated = false;
  let failurePolicyCreated = false;
  let passed = 0;
  let testFailure;
  const cleanupErrors = [];

  async function check(name, action) {
    await action();
    passed++;
    console.log(`PASS ${passed}: ${name}`);
  }
  async function newAccount(label, profile) {
    const account = {
      email: `arkst-${runId}-${label}@example.test`,
      password: `T!${randomBytes(24).toString('base64url')}`,
    };
    const created = noDatabaseError(
      await admin.auth.admin.createUser({ ...account, email_confirm: true }),
      'create isolated Auth account',
    );
    assert.ok(created.user?.id);
    account.id = created.user.id;
    accounts.push(account);
    if (profile)
      noDatabaseError(
        await admin.from('profiles').insert({
          id: account.id,
          display_name: `Isolated ${label} ${runId}`,
          ...profile,
        }),
        'provision isolated profile',
      );
    return account;
  }
  async function directClient(account) {
    const client = createClient(
      config.supabaseOrigin,
      config.publicKey,
      options,
    );
    noDatabaseError(
      await client.auth.signInWithPassword({
        email: account.email,
        password: account.password,
      }),
      'real direct-client authentication',
    );
    return client;
  }
  async function removeFailurePolicy() {
    if (!failurePolicyCreated) return;
    // Identifiers contain only a fixed prefix and crypto-generated hexadecimal characters.
    await database.query(
      `DROP POLICY "${policy}" ON public.profiles; DROP FUNCTION "${schema}".fail_for_test_actor(); DROP SCHEMA "${schema}";`,
    );
    failurePolicyCreated = false;
  }

  try {
    await database.connect();
    connected = true;
    await database.query('SELECT 1 FROM public.profiles LIMIT 0');
    noDatabaseError(
      await admin.from('scopes').insert({
        id: scopeId,
        kind: 'department',
        name: `Isolated identity test ${runId}`,
      }),
      'create isolated scope',
    );
    scopeCreated = true;
    const student = {
      account_kind: 'student',
      staff_classification: null,
      is_active: true,
    };
    const a = await newAccount('student-a', student);
    const b = await newAccount('student-b', student);
    const inactive = await newAccount('inactive', {
      ...student,
      is_active: false,
    });
    const unprovisioned = await newAccount('unprovisioned');
    const staff = await newAccount('staff', {
      account_kind: 'staff',
      staff_classification: 'non_teaching',
      is_active: true,
    });
    noDatabaseError(
      await admin.from('responsibility_assignments').insert(
        ['teacher', 'counselor', 'placement_coordinator'].map((role) => ({
          user_id: staff.id,
          role,
          scope_id: scopeId,
        })),
      ),
      'assign simultaneous staff responsibilities',
    );

    await check(
      'email/password provider allows authentication without enabling public signup',
      async () => {
        const result = await anonymous.auth.signUp({
          email: `arkst-signup-check-${runId}@example.test`,
          password: `T!${randomBytes(24).toString('base64url')}`,
        });
        // If config regresses and a user is unexpectedly created, track it for
        // deletion in finally before marking the assertion failed.
        if (result.data.user?.id) accounts.push({ id: result.data.user.id });
        assert.equal(result.error?.code, 'signup_disabled');
        assert.equal(result.data.session, null);
      },
    );

    const browser = new AppBrowser(config.appOrigin);
    const clientA = await directClient(a);
    const staffClient = await directClient(staff);

    await check(
      'anonymous application and direct database requests are denied',
      async () => {
        assert.equal((await browser.request('/api/me')).status, 401);
        deniedRead(await anonymous.from('profiles').select('id'));
      },
    );
    await check(
      'real authorized sign-in returns own database profile',
      async () => {
        await browser.login(a);
        const response = await browser.request('/api/me');
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.profile.id, a.id);
        assert.equal(body.profile.account_kind, 'student');
        assert.deepEqual(body.responsibilities, []);
        assert.match(response.headers.get('cache-control') ?? '', /no-store/);
        assert.equal((await browser.request('/profile')).status, 200);
      },
    );
    await check(
      'user A cannot read B through REST or a forged application query ID',
      async () => {
        deniedRead(await clientA.from('profiles').select('*').eq('id', b.id));
        const response = await browser.request(
          `/api/me?id=${b.id}&user_id=${b.id}&role=admin`,
        );
        assert.equal(response.status, 200);
        assert.equal((await response.json()).profile.id, a.id);
      },
    );
    await check(
      'staff classification and three simultaneous scoped responsibilities remain separate',
      async () => {
        const staffBrowser = new AppBrowser(config.appOrigin);
        await staffBrowser.login(staff);
        const response = await staffBrowser.request('/api/me');
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.profile.staff_classification, 'non_teaching');
        assert.deepEqual(body.responsibilities.map((r) => r.role).sort(), [
          'counselor',
          'placement_coordinator',
          'teacher',
        ]);
        deniedRead(
          await staffClient.from('profiles').select('*').eq('id', a.id),
        );
      },
    );
    await check(
      'users cannot assign counselor, coordinator, HOD or admin through REST',
      async () => {
        for (const role of ['counselor', 'coordinator', 'hod', 'admin']) {
          deniedWrite(
            await clientA
              .from('responsibility_assignments')
              .insert({ user_id: a.id, role, scope_id: scopeId }),
          );
          deniedWrite(
            await staffClient
              .from('responsibility_assignments')
              .insert({ user_id: staff.id, role, scope_id: scopeId }),
          );
        }
        deniedWrite(
          await staffClient
            .from('responsibility_assignments')
            .update({ role: 'admin' })
            .eq('user_id', staff.id),
        );
        deniedWrite(
          await staffClient
            .from('responsibility_assignments')
            .delete()
            .eq('user_id', staff.id),
        );
        deniedWrite(
          await clientA
            .from('profiles')
            .update({ account_kind: 'staff', staff_classification: 'teaching' })
            .eq('id', a.id),
        );
      },
    );
    await check(
      'editable account metadata never grants application responsibilities',
      async () => {
        noDatabaseError(
          await clientA.auth.updateUser({
            data: { role: 'admin', roles: ['admin'], user_id: staff.id },
          }),
          'update untrusted metadata',
        );
        const response = await browser.request('/api/me');
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.profile.id, a.id);
        assert.deepEqual(body.responsibilities, []);
      },
    );
    await check(
      'inactive and unprovisioned Auth users cannot access application or private profile data',
      async () => {
        for (const account of [inactive, unprovisioned]) {
          const deniedBrowser = new AppBrowser(config.appOrigin);
          await deniedBrowser.login(account);
          assert.equal((await deniedBrowser.request('/api/me')).status, 403);
          deniedRead(
            await (await directClient(account)).from('profiles').select('*'),
          );
        }
      },
    );
    await check(
      'invalid credentials and malformed session cookies fail authentication',
      async () => {
        const invalid = new AppBrowser(config.appOrigin);
        assert.equal(
          (
            await invalid.request('/auth/login', {
              method: 'POST',
              headers: { Origin: config.appOrigin },
              body: new URLSearchParams({
                email: a.email,
                password: `invalid-${randomUUID()}`,
              }),
            })
          ).status,
          401,
        );
        invalid.cookies.set('arkst-session', 'base64-this-is-not-a-session');
        assert.equal((await invalid.request('/api/me')).status, 401);
      },
    );
    await check(
      'cross-origin login and logout requests are denied',
      async () => {
        for (const route of ['/auth/login', '/auth/logout']) {
          const response = await browser.request(route, {
            method: 'POST',
            headers: { Origin: 'https://untrusted.invalid' },
            body: new URLSearchParams({ email: a.email, password: a.password }),
          });
          assert.equal(response.status, 403);
        }
        assert.equal((await browser.request('/api/me')).status, 200);
      },
    );
    await check(
      'a real PostgreSQL query failure produces an accurate visible 503, then recovers',
      async () => {
        assert.match(a.id, /^[0-9a-f-]{36}$/);
        await database.query(`BEGIN;
        CREATE SCHEMA "${schema}";
        CREATE FUNCTION "${schema}".fail_for_test_actor() RETURNS boolean LANGUAGE plpgsql VOLATILE SET search_path = '' AS $fn$
          BEGIN IF auth.uid() = '${a.id}'::uuid THEN RAISE EXCEPTION 'isolated identity database failure' USING ERRCODE = '58000'; END IF; RETURN true; END;
        $fn$;
        REVOKE ALL ON FUNCTION "${schema}".fail_for_test_actor() FROM PUBLIC;
        GRANT USAGE ON SCHEMA "${schema}" TO authenticated;
        GRANT EXECUTE ON FUNCTION "${schema}".fail_for_test_actor() TO authenticated;
        CREATE POLICY "${policy}" ON public.profiles AS RESTRICTIVE FOR SELECT TO authenticated USING ("${schema}".fail_for_test_actor());
        COMMIT;`);
        failurePolicyCreated = true;
        const response = await browser.request('/api/me');
        assert.equal(response.status, 503);
        assert.match(await response.text(), /database|profile|unavailable/i);
        await removeFailurePolicy();
        assert.equal((await browser.request('/api/me')).status, 200);
      },
    );
    await check('logout removes application session access', async () => {
      const response = await browser.request('/auth/logout', {
        method: 'POST',
        headers: { Origin: config.appOrigin },
      });
      assert.equal(response.status, 303);
      assert.equal(
        new URL(response.headers.get('location'), config.appOrigin).pathname,
        '/login',
      );
      assert.equal(
        [...browser.cookies.keys()].filter((name) =>
          name.startsWith('arkst-session'),
        ).length,
        0,
      );
      assert.equal((await browser.request('/api/me')).status, 401);
    });
  } catch (error) {
    testFailure = error;
  } finally {
    if (connected) {
      try {
        await database.query('ROLLBACK');
        await removeFailurePolicy();
      } catch (error) {
        cleanupErrors.push(
          `temporary failure-policy cleanup: ${error.message}`,
        );
      }
    }
    for (const account of accounts.toReversed()) {
      try {
        noDatabaseError(
          await admin.auth.admin.deleteUser(account.id),
          'delete generated Auth user',
        );
      } catch (error) {
        cleanupErrors.push(`generated user ${account.id}: ${error.message}`);
      }
    }
    if (scopeCreated) {
      try {
        noDatabaseError(
          await admin.from('scopes').delete().eq('id', scopeId),
          'delete generated scope',
        );
      } catch (error) {
        cleanupErrors.push(`generated scope ${scopeId}: ${error.message}`);
      }
    }
    if (connected) await database.end();
  }
  if (testFailure || cleanupErrors.length) {
    console.error(
      `FAILED after ${passed} completed checks. ${testFailure?.message ?? 'Test cleanup failed.'}`,
    );
    for (const message of cleanupErrors)
      console.error(`CLEANUP REQUIRED: ${message}`);
    if (failurePolicyCreated)
      console.error(
        `Remove policy ${policy} on public.profiles and schema ${schema} in the isolated local database.`,
      );
    process.exitCode = 1;
    return;
  }
  console.log(
    `PASS: ${passed} real local Auth/PostgreSQL/application checks. Generated accounts, scope and temporary failure policy cleaned up.`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
