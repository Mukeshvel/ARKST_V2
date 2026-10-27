import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
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

const exec = promisify(execFile);
async function main() {
  const config = localTestConfiguration(process.env);
  const tag = randomBytes(6).toString('hex');
  const options = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch: localFetch(config.supabaseOrigin) },
  };
  const admin = createClient(config.supabaseOrigin, config.serviceKey, options);
  const db = new pg.Client({
    connectionString: config.databaseUrl,
    connectionTimeoutMillis: 5000,
    query_timeout: 10000,
  });
  const directory = path.resolve('scripts/directory-admin.mjs');
  const temp = await mkdtemp(path.join(os.tmpdir(), 'arkst-directory-'));
  const ids = {
    department: randomUUID(),
    sectionA: randomUUID(),
    sectionB: randomUUID(),
    outside: randomUUID(),
    auditFailureFunction: `test_directory_audit_failure_${tag}`,
    auditFailureTrigger: `test_directory_audit_failure_${tag}`,
  };
  const users = [];
  let connected = false,
    passed = 0,
    failure;
  const cleanupErrors = [];
  async function check(label, fn) {
    await fn();
    console.log(`PASS ${++passed}: ${label}`);
  }
  async function user(label, kind = 'staff', profile = true) {
    const entry = {
      email: `arkst-dir-${tag}-${label}@example.test`,
      password: `T!${randomBytes(24).toString('base64url')}`,
    };
    entry.id = noDatabaseError(
      await admin.auth.admin.createUser({ ...entry, email_confirm: true }),
      'create local Auth user',
    ).user.id;
    users.push(entry);
    if (profile)
      noDatabaseError(
        await admin.from('profiles').insert({
          id: entry.id,
          display_name: `Directory ${label}`,
          account_kind: kind,
          staff_classification: kind === 'staff' ? 'teaching' : null,
          is_active: true,
        }),
        'provision local profile',
      );
    entry.client = createClient(
      config.supabaseOrigin,
      config.publicKey,
      options,
    );
    entry.browser = new AppBrowser(config.appOrigin);
    if (profile) {
      noDatabaseError(
        await entry.client.auth.signInWithPassword({
          email: entry.email,
          password: entry.password,
        }),
        'real Supabase sign-in',
      );
      await entry.browser.login(entry);
    }
    return entry;
  }
  async function responsibility(person, role, scope = ids.department) {
    return noDatabaseError(
      await admin
        .from('responsibility_assignments')
        .insert({
          user_id: person.id,
          role,
          scope_id: scope,
          starts_at: new Date(Date.now() - 86400000).toISOString(),
        })
        .select('id')
        .single(),
      'provision test responsibility',
    ).id;
  }
  async function adminCommand(
    command,
    operator,
    extra = [],
    expectSuccess = true,
  ) {
    const args = [
      directory,
      command,
      '--operator',
      operator.id,
      '--department',
      ids.department,
      ...extra,
    ];
    try {
      const { stdout, stderr } = await exec(process.execPath, args, {
        env: {
          LOCAL_DATABASE_URL: config.databaseUrl,
          PATH: process.env.PATH,
          SystemRoot: process.env.SystemRoot,
        },
        timeout: 20000,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      });
      if (!expectSuccess)
        throw new Error(
          `Expected ${command} to fail, output: ${stdout}${stderr}`,
        );
      return stdout + stderr;
    } catch (error) {
      if (expectSuccess) throw error;
      assert.notEqual(error.code, 0);
      return `${error.stdout ?? ''}${error.stderr ?? ''}`;
    }
  }
  async function writeCsv(name, body) {
    const file = path.join(temp, name);
    await writeFile(file, body, 'utf8');
    return file;
  }
  async function api(person, path, body, expected = 200) {
    const response = await person.browser.request(
      path,
      body === undefined
        ? {}
        : {
            method: 'POST',
            headers: {
              Origin: config.appOrigin,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          },
    );
    assert.equal(
      response.status,
      expected,
      `${path}: ${await response.clone().text()}`,
    );
    return response.json();
  }
  try {
    await db.connect();
    connected = true;
    await db.query('select 1 from public.staff_directory_profiles limit 0');
    for (const scope of [ids.department, ids.outside])
      await db.query(
        "insert into public.scopes(id,name,kind) values($1,$2,'department')",
        [scope, `Test ${tag}`],
      );
    for (const [id, name] of [
      [ids.sectionA, 'Section A'],
      [ids.sectionB, 'Section B'],
    ])
      await db.query(
        "insert into public.scopes(id,name,kind,parent_id) values($1,$2,'section',$3)",
        [id, name, ids.department],
      );
    const operator = await user('department-admin');
    await responsibility(operator, 'admin');
    const deniedOperator = await user('unapproved-operator');
    await responsibility(deniedOperator, 'teacher');
    const counselorA = await user('counselor-a');
    const counselorAResp = await responsibility(counselorA, 'counselor');
    const counselorB = await user('counselor-b');
    const counselorBResp = await responsibility(counselorB, 'counselor');
    const teacher = await user('teacher');
    const teacherResp = await responsibility(teacher, 'teacher');
    const studentList = await Promise.all(
      ['1042', '90001', 'S-A-17', '051'].map((label) =>
        user(`student-${label}`, 'student'),
      ),
    );
    const placement = await user('new-placement', 'staff', false);

    await check(
      'roster preview validates arbitrary identifiers without writing or creating Auth users',
      async () => {
        const rows = studentList
          .map(
            (s, i) =>
              `${['1042', '90001', 'S-A-17', '051'][i]},\"Student ${i + 1}, Roster\",${i % 2 ? ids.sectionB : ids.sectionA},${s.id}`,
          )
          .join('\n');
        const file = await writeCsv(
          'roster.csv',
          `student_identifier,display_name,section_scope_id,linked_student_id\n${rows}\n`,
        );
        const output = await adminCommand('import-roster', operator, [
          '--file',
          file,
        ]);
        assert.match(output, /PREVIEW ONLY/);
        assert.equal(
          (
            await db.query(
              'select count(*)::int n from public.department_student_roster where department_scope_id=$1',
              [ids.department],
            )
          ).rows[0].n,
          0,
        );
        assert.equal(
          (
            await db.query(
              'select count(*)::int n from auth.users where email like $1',
              [`arkst-dir-${tag}-%@example.test`],
            )
          ).rows[0].n,
          studentList.length + 6,
        );
      },
    );
    let rosterFile;
    await check(
      'approved roster import commits all rows and direct section memberships atomically',
      async () => {
        const rows = studentList
          .map(
            (s, i) =>
              `${['1042', '90001', 'S-A-17', '051'][i]},\"Student ${i + 1}, Roster\",${i % 2 ? ids.sectionB : ids.sectionA},${s.id}`,
          )
          .join('\n');
        rosterFile = await writeCsv(
          'roster.csv',
          `student_identifier,display_name,section_scope_id,linked_student_id\n${rows}\n`,
        );
        const output = await adminCommand('import-roster', operator, [
          '--file',
          rosterFile,
          '--apply',
        ]);
        assert.match(output, /COMMITTED: 4 records/);
        assert.equal(
          (
            await db.query(
              'select count(*)::int n from public.department_student_roster where department_scope_id=$1',
              [ids.department],
            )
          ).rows[0].n,
          4,
        );
        assert.equal(
          (
            await db.query(
              'select count(*)::int n from public.student_scope_memberships where scope_id=any($1::uuid[])',
              [[ids.sectionA, ids.sectionB]],
            )
          ).rows[0].n,
          4,
        );
        assert.equal(
          (
            await db.query(
              "select count(*)::int n from public.department_directory_audit where entity_type='student_roster' and actor_id=$1",
              [operator.id],
            )
          ).rows[0].n,
          4,
        );
      },
    );

    await check(
      'invalid roster, duplicate external identifiers and unauthorized operator are rejected without partial writes',
      async () => {
        const before = (
          await db.query(
            'select count(*)::int n from public.department_student_roster where department_scope_id=$1',
            [ids.department],
          )
        ).rows[0].n;
        const duplicate = await writeCsv(
          'duplicate.csv',
          `student_identifier,display_name,section_scope_id,linked_student_id\nX1,One,${ids.sectionA},\nX1,Two,${ids.sectionB},\n`,
        );
        assert.match(
          await adminCommand(
            'import-roster',
            operator,
            ['--file', duplicate],
            false,
          ),
          /unique external strings/,
        );
        const invalid = await writeCsv(
          'invalid-roster.csv',
          `student_identifier,display_name,section_scope_id,linked_student_id\nX2,Wrong section,${ids.outside},\n`,
        );
        assert.match(
          await adminCommand(
            'import-roster',
            operator,
            ['--file', invalid, '--apply'],
            false,
          ),
          /direct child/,
        );
        assert.match(
          await adminCommand(
            'import-roster',
            deniedOperator,
            ['--file', invalid],
            false,
          ),
          /must be an active staff member/,
        );
        assert.equal(
          (
            await db.query(
              'select count(*)::int n from public.department_student_roster where department_scope_id=$1',
              [ids.department],
            )
          ).rows[0].n,
          before,
        );
        deniedWrite(
          await teacher.client.from('department_student_roster').insert({
            department_scope_id: ids.department,
            external_student_id: 'forged',
            display_name: 'Forged',
            section_scope_id: ids.sectionA,
            created_by: teacher.id,
          }),
        );
      },
    );

    await check(
      'counselor CSV supports variable counts and gives access to assigned non-consecutive roster identifiers only',
      async () => {
        const records = [studentList[0], studentList[1], studentList[2]].map(
          (s) =>
            `${['1042', '90001', 'S-A-17'][studentList.indexOf(s)]},${counselorAResp},${new Date(Date.now() - 60000).toISOString()}`,
        );
        records.push(
          `051,${counselorBResp},${new Date(Date.now() - 60000).toISOString()}`,
        );
        const file = await writeCsv(
          'counselors.csv',
          `student_identifier,counselor_responsibility_id,starts_at\n${records.join('\n')}\n`,
        );
        assert.match(
          await adminCommand('import-counselors', operator, ['--file', file]),
          /PREVIEW ONLY/,
        );
        assert.equal(
          (
            await db.query(
              'select count(*)::int n from public.counselor_student_mappings',
            )
          ).rows[0].n,
          0,
        );
        const output = await adminCommand('import-counselors', operator, [
          '--file',
          file,
          '--apply',
        ]);
        assert.match(output, /COMMITTED: 4 records/);
        assert.equal(
          (
            await db.query(
              'select count(*)::int n from public.counselor_student_mappings m join public.department_student_roster s on s.id=m.roster_student_id where m.counselor_responsibility_id=$1',
              [counselorAResp],
            )
          ).rows[0].n,
          3,
        );
        assert.equal(
          (
            await db.query(
              'select count(*)::int n from public.counselor_student_mappings m join public.department_student_roster s on s.id=m.roster_student_id where m.counselor_responsibility_id=$1',
              [counselorBResp],
            )
          ).rows[0].n,
          1,
        );
        const visible = await api(counselorA, '/api/counselor/students');
        assert.equal(visible.students.length, 3);
        assert.deepEqual(
          visible.students.map((x) => x.student.external_student_id).sort(),
          ['1042', '90001', 'S-A-17'],
        );
        const other = await api(counselorB, '/api/counselor/students');
        assert.deepEqual(
          other.students.map((x) => x.student.external_student_id),
          ['051'],
        );
        deniedRead(
          await teacher.client.from('department_student_roster').select('*'),
        );
        deniedRead(
          await teacher.client.from('counselor_student_mappings').select('*'),
        );
      },
    );

    await check(
      'invalid, duplicate and unauthorized counselor mappings never partially commit',
      async () => {
        const before = (
          await db.query(
            'select count(*)::int n from public.counselor_student_mappings',
          )
        ).rows[0].n;
        const unknown = await writeCsv(
          'unknown-map.csv',
          `student_identifier,counselor_responsibility_id,starts_at\nNOT-IN-ROSTER,${counselorAResp},${new Date(Date.now() - 60000).toISOString()}\n`,
        );
        assert.match(
          await adminCommand(
            'import-counselors',
            operator,
            ['--file', unknown, '--apply'],
            false,
          ),
          /not found exactly once/,
        );
        const invalidRole = await writeCsv(
          'wrong-role.csv',
          `student_identifier,counselor_responsibility_id,starts_at\n1042,${teacherResp},${new Date(Date.now() - 60000).toISOString()}\n`,
        );
        assert.match(
          await adminCommand(
            'import-counselors',
            operator,
            ['--file', invalidRole, '--apply'],
            false,
          ),
          /not a current counselor/,
        );
        const duplicate = await writeCsv(
          'duplicate-map.csv',
          `student_identifier,counselor_responsibility_id,starts_at\n1042,${counselorAResp},2026-10-27T00:00:00.000Z\n1042,${counselorAResp},2026-10-27T00:00:00.000Z\n`,
        );
        // Both pass preview validation against the unchanged DB; a uniqueness conflict in
        // the second write must roll back the first row and all its audit events.
        assert.match(
          await adminCommand(
            'import-counselors',
            operator,
            ['--file', duplicate, '--apply'],
            false,
          ),
          /duplicate key|duplicate|unique/i,
        );
        assert.equal(
          (
            await db.query(
              'select count(*)::int n from public.counselor_student_mappings',
            )
          ).rows[0].n,
          before,
        );
        deniedWrite(
          await teacher.client.from('counselor_student_mappings').insert({
            roster_student_id: randomUUID(),
            counselor_responsibility_id: teacherResp,
            created_by: teacher.id,
          }),
        );
      },
    );

    await check(
      'department admin provisions an existing confirmed Auth account; preview has no effects and role text cannot be self-assigned',
      async () => {
        const sections = `${ids.sectionA},${ids.sectionB}`;
        const extra = [
          '--user',
          placement.id,
          '--status',
          'non_teaching',
          '--role',
          'placement_coordinator',
          '--sections',
          sections,
          '--categories',
          'general',
          '--designation',
          'Placement Coordinator',
        ];
        const preview = await adminCommand('provision-staff', operator, extra);
        assert.match(preview, /PREVIEW ONLY/);
        assert.equal(
          (
            await db.query(
              'select count(*)::int n from public.profiles where id=$1',
              [placement.id],
            )
          ).rows[0].n,
          0,
        );
        await adminCommand('provision-staff', operator, [...extra, '--apply']);
        noDatabaseError(
          await placement.client.auth.signInWithPassword({
            email: placement.email,
            password: placement.password,
          }),
          'provisioned staff signs in through Supabase Auth',
        );
        await placement.browser.login(placement);
        assert.equal(
          (
            await db.query(
              "select count(*)::int n from public.activity_capabilities c join public.responsibility_assignments r on r.id=c.responsibility_id where r.user_id=$1 and r.scope_id=$2 and c.category_key='general' and c.can_create",
              [placement.id, ids.department],
            )
          ).rows[0].n,
          1,
        );
        assert.equal(
          (
            await db.query(
              "select count(*)::int n from public.responsibility_assignments where user_id=$1 and role in ('admin','hod')",
              [placement.id],
            )
          ).rows[0].n,
          0,
        );
        const student = studentList[1];
        const created = await api(
          placement,
          '/api/activities',
          {
            category: 'general',
            scopeId: ids.sectionB,
            title: 'Placement staff direct test',
            description: '',
            startsAt: new Date(Date.now() - 60000).toISOString(),
            deadlineAt: new Date(Date.now() + 3600000).toISOString(),
            endsAt: new Date(Date.now() + 3600000).toISOString(),
            requiresVerification: false,
            studentIds: [student.id],
          },
          201,
        );
        assert.ok(created.id);
        const sectionAActivity = await api(
          placement,
          '/api/activities',
          {
            category: 'general',
            scopeId: ids.sectionA,
            title: 'Placement staff Section A test',
            description: '',
            startsAt: new Date(Date.now() - 60000).toISOString(),
            deadlineAt: new Date(Date.now() + 3600000).toISOString(),
            endsAt: new Date(Date.now() + 3600000).toISOString(),
            requiresVerification: false,
            studentIds: [studentList[0].id],
          },
          201,
        );
        assert.ok(sectionAActivity.id);
        assert.equal(
          (
            await db.query(
              'select count(*)::int n from public.activities where id=any($1::uuid[]) and scope_id=any($2::uuid[])',
              [
                [created.id, sectionAActivity.id],
                [ids.sectionA, ids.sectionB],
              ],
            )
          ).rows[0].n,
          2,
        );
        const hidden = await placement.browser.request(
          `/api/activities/${created.id}`,
        );
        assert.equal(
          hidden.status,
          404,
          'department create grant must not imply child-section read',
        );
        deniedRead(
          await placement.client.from('department_student_roster').select('*'),
        );
        const assigned = await db.query(
          'select id from public.activity_assignments where activity_id=$1',
          [created.id],
        );
        await api(
          placement,
          `/api/activity-assignments/${assigned.rows[0].id}/verify`,
          {},
          403,
        );
      },
    );

    await check(
      'reassignment and revocation preserve history while active and inactive counselor views change',
      async () => {
        const sectionBOnly = await responsibility(
          counselorB,
          'counselor',
          ids.sectionB,
        );
        const wrongScope = await writeCsv(
          'wrong-section-reassignment.csv',
          `student_identifier,counselor_responsibility_id\n1042,${sectionBOnly}\n`,
        );
        assert.match(
          await adminCommand(
            'reassign-counselors',
            operator,
            ['--file', wrongScope, '--apply'],
            false,
          ),
          /not approved for this scope/,
        );
        const reassignment = await writeCsv(
          'reassignment.csv',
          `student_identifier,counselor_responsibility_id\n1042,${counselorBResp}\n`,
        );
        assert.match(
          await adminCommand('reassign-counselors', operator, [
            '--file',
            reassignment,
          ]),
          /PREVIEW ONLY/,
        );
        await adminCommand('reassign-counselors', operator, [
          '--file',
          reassignment,
          '--apply',
        ]);
        const oldAccess = await api(counselorA, '/api/counselor/students');
        assert.deepEqual(
          oldAccess.students.map((x) => x.student.external_student_id).sort(),
          ['90001', 'S-A-17'],
        );
        const newAccess = await api(counselorB, '/api/counselor/students');
        assert.deepEqual(
          newAccess.students.map((x) => x.student.external_student_id).sort(),
          ['051', '1042'],
        );
        assert.equal(
          (
            await db.query(
              `select count(*)::int n from public.counselor_student_mappings m
           join public.department_student_roster s on s.id=m.roster_student_id
           where s.external_student_id='1042' and s.department_scope_id=$1`,
              [ids.department],
            )
          ).rows[0].n,
          2,
        );
        const oldHistory = await db.query(
          `select ends_at from public.counselor_student_mappings m
           join public.department_student_roster s on s.id=m.roster_student_id
           where s.external_student_id='1042' and m.counselor_responsibility_id=$1`,
          [counselorAResp],
        );
        assert.ok(oldHistory.rows[0].ends_at instanceof Date);
        await assert.rejects(
          db.query(
            `insert into public.counselor_student_mappings(roster_student_id,counselor_responsibility_id,created_by)
             select id,$1,$2 from public.department_student_roster where department_scope_id=$3 and external_student_id='1042'`,
            [counselorAResp, operator.id, ids.department],
          ),
          (error) => error.code === '23P01',
        );
        await db.query(
          `update public.department_student_roster set active=false where department_scope_id=$1 and external_student_id='90001'`,
          [ids.department],
        );
        const activeOnly = await api(counselorA, '/api/counselor/students');
        assert.deepEqual(
          activeOnly.students.map((x) => x.student.external_student_id),
          ['S-A-17'],
        );
        assert.equal(
          (
            await db.query(
              `select count(*)::int n from public.counselor_student_mappings m
           join public.department_student_roster s on s.id=m.roster_student_id
           where s.department_scope_id=$1 and s.external_student_id='90001'`,
              [ids.department],
            )
          ).rows[0].n,
          1,
        );
        assert.equal(
          (
            await db.query(
              `select count(*)::int n from public.activities where scope_id=$1 and title='Placement staff direct test'`,
              [ids.sectionB],
            )
          ).rows[0].n,
          1,
        );
        const revocation = await writeCsv(
          'revocation.csv',
          'student_identifier\n051\n',
        );
        await adminCommand('revoke-counselors', operator, [
          '--file',
          revocation,
          '--apply',
        ]);
        const afterRevoke = await api(counselorB, '/api/counselor/students');
        assert.deepEqual(
          afterRevoke.students.map((x) => x.student.external_student_id),
          ['1042'],
        );
        assert.equal(
          (
            await db.query(
              `select count(*)::int n from public.counselor_student_mappings m
           join public.department_student_roster s on s.id=m.roster_student_id
           where s.department_scope_id=$1 and s.external_student_id='051'`,
              [ids.department],
            )
          ).rows[0].n,
          1,
        );
        const roster051 = await db.query(
          `select id from public.department_student_roster where department_scope_id=$1 and external_student_id='051'`,
          [ids.department],
        );
        const contenders = [0, 1].map(
          () =>
            new pg.Client({
              connectionString: config.databaseUrl,
              connectionTimeoutMillis: 5000,
              query_timeout: 10000,
            }),
        );
        try {
          await Promise.all(contenders.map((client) => client.connect()));
          const raced = await Promise.allSettled(
            contenders.map((client) =>
              client.query(
                `insert into public.counselor_student_mappings(roster_student_id,counselor_responsibility_id,created_by)
                 values($1,$2,$3)`,
                [roster051.rows[0].id, counselorBResp, operator.id],
              ),
            ),
          );
          const raceOutcomes = raced.map((x) =>
            x.status === 'fulfilled'
              ? 'committed'
              : (x.reason.code ?? x.reason.message),
          );
          assert.equal(
            raced.filter((x) => x.status === 'fulfilled').length,
            1,
            `concurrent outcomes: ${raceOutcomes.join(', ')}`,
          );
          assert.equal(
            raced.filter(
              (x) =>
                x.status === 'rejected' &&
                ['23P01', '23505'].includes(x.reason.code),
            ).length,
            1,
            `concurrent outcomes: ${raceOutcomes.join(', ')}`,
          );
        } finally {
          await Promise.all(contenders.map((client) => client.end()));
        }
        assert.equal(
          (
            await db.query(
              `select count(*)::int n from public.counselor_student_mappings
               where roster_student_id=$1 and starts_at<=now() and (ends_at is null or now()<ends_at)`,
              [roster051.rows[0].id],
            )
          ).rows[0].n,
          1,
        );
      },
    );

    await check(
      'faculty edits teaching status, Both sections, subject and custom designation; counselor mappings are unchanged',
      async () => {
        const before = await db.query(
          'select count(*)::int n from public.counselor_student_mappings where counselor_responsibility_id=$1',
          [counselorAResp],
        );
        const update = {
          profile: {
            teachingStatus: 'non_teaching',
            designation: 'German and Java Programme Coordinator',
            subjects: ['German', 'Java'],
            sectionIds: [ids.sectionA, ids.sectionB],
          },
        };
        await api(counselorA, '/api/staff-directory', update, 200);
        const rpcDuplicate = await counselorA.client.rpc(
          'update_staff_directory_profile',
          {
            p_teaching_status: 'teaching',
            p_designation: 'Duplicate subjects',
            p_subjects: ['Java', ' java '],
            p_section_ids: [ids.sectionA],
          },
        );
        assert.equal(rpcDuplicate.error?.code, '23514');
        const fresh = new AppBrowser(config.appOrigin);
        await fresh.login(counselorA);
        const loaded = await fresh.request('/api/staff-directory');
        assert.equal(loaded.status, 200);
        const profile = await loaded.json();
        assert.equal(profile.teachingStatus, 'non_teaching');
        assert.equal(profile.designation, update.profile.designation);
        assert.deepEqual(profile.subjects, ['German', 'Java']);
        assert.deepEqual(
          profile.sectionIds.sort(),
          [ids.sectionA, ids.sectionB].sort(),
        );
        assert.equal(
          (
            await db.query(
              'select staff_classification from public.profiles where id=$1',
              [counselorA.id],
            )
          ).rows[0].staff_classification,
          'non_teaching',
        );
        assert.equal(
          (
            await db.query(
              'select count(*)::int n from public.counselor_student_mappings where counselor_responsibility_id=$1',
              [counselorAResp],
            )
          ).rows[0].n,
          before.rows[0].n,
        );
        assert.ok(
          (
            await db.query(
              "select count(*)::int n from public.department_directory_audit where actor_id=$1 and entity_type='staff_profile'",
              [counselorA.id],
            )
          ).rows[0].n >= 1,
        );
      },
    );

    await check(
      'non-teaching placement staff stores both sections and custom designation without gaining counselor/HOD/Admin',
      async () => {
        const payload = {
          profile: {
            teachingStatus: 'non_teaching',
            designation: 'Placement Coordinator',
            subjects: ['Placement'],
            sectionIds: [ids.sectionA, ids.sectionB],
          },
        };
        const response = await api(placement, '/api/staff-directory', payload);
        assert.equal(response.teachingStatus, 'non_teaching');
        assert.equal(response.sectionIds.length, 2);
        assert.equal(
          (
            await db.query(
              "select count(*)::int n from public.responsibility_assignments where user_id=$1 and role in ('counselor','hod','admin')",
              [placement.id],
            )
          ).rows[0].n,
          0,
        );
        deniedWrite(
          await placement.client.from('responsibility_assignments').insert({
            user_id: placement.id,
            role: 'hod',
            scope_id: ids.department,
          }),
        );
        deniedWrite(
          await placement.client.from('activity_capabilities').insert({
            responsibility_id: (
              await db.query(
                "select id from public.responsibility_assignments where user_id=$1 and role='placement_coordinator'",
                [placement.id],
              )
            ).rows[0].id,
            category_key: 'placement',
            can_create: true,
          }),
        );
      },
    );

    await check(
      'database failure during profile audit returns 503 and rolls back profile and section changes',
      async () => {
        const beforeProfile = await db.query(
          'select teaching_status,designation,subjects from public.staff_directory_profiles where user_id=$1',
          [placement.id],
        );
        const beforeSections = await db.query(
          'select section_scope_id from public.staff_section_preferences where user_id=$1 order by section_scope_id',
          [placement.id],
        );
        assert.equal(beforeProfile.rowCount, 1);
        await db.query(`
          create function public.${ids.auditFailureFunction}() returns trigger
          language plpgsql as $$ begin raise exception 'synthetic local audit write failure'; end $$;
          create trigger ${ids.auditFailureTrigger}
          before insert on public.department_directory_audit
          for each row when (new.entity_type = 'staff_profile')
          execute function public.${ids.auditFailureFunction}();
        `);
        try {
          await api(
            placement,
            '/api/staff-directory',
            {
              profile: {
                teachingStatus: 'teaching',
                designation: 'Must Roll Back',
                subjects: ['Synthetic changed subject'],
                sectionIds: [ids.sectionA],
              },
            },
            503,
          );
          const afterProfile = await db.query(
            'select teaching_status,designation,subjects from public.staff_directory_profiles where user_id=$1',
            [placement.id],
          );
          const afterSections = await db.query(
            'select section_scope_id from public.staff_section_preferences where user_id=$1 order by section_scope_id',
            [placement.id],
          );
          assert.deepEqual(afterProfile.rows, beforeProfile.rows);
          assert.deepEqual(afterSections.rows, beforeSections.rows);
        } finally {
          await db.query(
            `drop trigger if exists ${ids.auditFailureTrigger} on public.department_directory_audit; drop function if exists public.${ids.auditFailureFunction}();`,
          );
        }
      },
    );

    await check(
      'students and faculty cannot edit another staff record or self-grant roles/capabilities',
      async () => {
        await api(
          studentList[0],
          '/api/staff-directory',
          {
            profile: {
              teachingStatus: 'teaching',
              designation: '',
              subjects: [],
              sectionIds: [],
            },
          },
          403,
        );
        deniedWrite(
          await studentList[0].client.from('staff_directory_profiles').insert({
            user_id: studentList[0].id,
            teaching_status: 'teaching',
            updated_by: studentList[0].id,
          }),
        );
        deniedWrite(
          await counselorA.client
            .from('staff_directory_profiles')
            .update({ designation: 'admin' })
            .eq('user_id', placement.id),
        );
        const forged = await api(
          counselorA,
          '/api/staff-directory',
          {
            profile: {
              teachingStatus: 'teaching',
              designation: 'HOD',
              subjects: [],
              sectionIds: [],
              userId: placement.id,
              role: 'admin',
            },
          },
          400,
        );
        assert.equal(forged.error, 'Unsupported field.');
        deniedRead(
          await counselorA.client
            .from('staff_directory_profiles')
            .select('*')
            .eq('user_id', placement.id),
        );
        deniedWrite(
          await counselorA.client.from('responsibility_assignments').insert({
            user_id: counselorA.id,
            role: 'admin',
            scope_id: ids.department,
          }),
        );
      },
    );

    await check(
      'unauthorized sections, malformed profiles, wrong origin and impossible user ids fail without persisting',
      async () => {
        const before = await db.query(
          'select count(*)::int n from public.staff_section_preferences where user_id=$1',
          [counselorA.id],
        );
        await api(
          counselorA,
          '/api/staff-directory',
          {
            profile: {
              teachingStatus: 'teaching',
              designation: '',
              subjects: [],
              sectionIds: [ids.outside],
            },
          },
          403,
        );
        for (const profile of [
          {
            teachingStatus: 'teaching',
            designation: '',
            subjects: [''],
            sectionIds: [],
          },
          {
            teachingStatus: 'teaching',
            designation: '',
            subjects: Array(21).fill('x'),
            sectionIds: [],
          },
          {
            teachingStatus: 'teaching',
            designation: '',
            subjects: [],
            sectionIds: [ids.sectionA, ids.sectionA],
          },
        ])
          await api(counselorA, '/api/staff-directory', { profile }, 400);
        const csrf = await counselorA.browser.request('/api/staff-directory', {
          method: 'POST',
          headers: {
            Origin: 'https://untrusted.invalid',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            profile: {
              teachingStatus: 'teaching',
              designation: '',
              subjects: [],
              sectionIds: [],
            },
          }),
        });
        assert.equal(csrf.status, 403);
        assert.equal(
          (
            await db.query(
              'select count(*)::int n from public.staff_section_preferences where user_id=$1',
              [counselorA.id],
            )
          ).rows[0].n,
          before.rows[0].n,
        );
      },
    );
  } catch (error) {
    failure = error;
  } finally {
    try {
      await rm(temp, { recursive: true, force: true });
    } catch (error) {
      cleanupErrors.push(`CSV temp directory: ${error.message}`);
    }
    if (connected) {
      try {
        await db.query(
          `drop trigger if exists ${ids.auditFailureTrigger} on public.department_directory_audit; drop function if exists public.${ids.auditFailureFunction}();`,
        );
        await db.query(
          'delete from public.activities where scope_id=any($1::uuid[])',
          [[ids.sectionA, ids.sectionB]],
        );
        await db.query(
          'delete from public.counselor_student_mappings where roster_student_id in(select id from public.department_student_roster where department_scope_id=$1)',
          [ids.department],
        );
        await db.query(
          'delete from public.department_student_roster where department_scope_id=$1',
          [ids.department],
        );
        await db.query(
          'delete from public.student_scope_memberships where scope_id=any($1::uuid[])',
          [[ids.sectionA, ids.sectionB]],
        );
        await db.query(
          'delete from public.department_directory_audit where actor_id=any($1::uuid[])',
          [users.map((x) => x.id)],
        );
        await db.query(
          'delete from public.staff_section_preferences where user_id=any($1::uuid[])',
          [users.map((x) => x.id)],
        );
        await db.query(
          'delete from public.staff_directory_profiles where user_id=any($1::uuid[])',
          [users.map((x) => x.id)],
        );
        await db.query(
          'delete from public.activity_capabilities where responsibility_id in(select id from public.responsibility_assignments where user_id=any($1::uuid[]))',
          [users.map((x) => x.id)],
        );
        await db.query(
          'delete from public.responsibility_assignments where user_id=any($1::uuid[])',
          [users.map((x) => x.id)],
        );
      } catch (error) {
        cleanupErrors.push(`database fixture cleanup: ${error.message}`);
      }
    }
    for (const entry of users.toReversed())
      try {
        noDatabaseError(
          await admin.auth.admin.deleteUser(entry.id),
          'delete test Auth user',
        );
      } catch (error) {
        cleanupErrors.push(`Auth ${entry.id}: ${error.message}`);
      }
    if (connected) {
      try {
        await db.query('delete from public.scopes where id=any($1::uuid[])', [
          [ids.sectionA, ids.sectionB],
        ]);
        await db.query('delete from public.scopes where id=any($1::uuid[])', [
          [ids.department, ids.outside],
        ]);
        const remaining = await db.query(
          'select count(*)::int n from public.profiles where id=any($1::uuid[])',
          [users.map((x) => x.id)],
        );
        assert.equal(remaining.rows[0].n, 0);
      } catch (error) {
        cleanupErrors.push(`scope/fixture check: ${error.message}`);
      }
      await db.end();
    }
  }
  if (failure || cleanupErrors.length) {
    console.error(
      `FAILED after ${passed} groups: ${failure?.message ?? 'cleanup failed'}`,
    );
    for (const e of cleanupErrors) console.error(`CLEANUP REQUIRED: ${e}`);
    process.exitCode = 1;
  } else
    console.log(
      `PASS: ${passed} real directory Auth/PostgreSQL/API/RLS groups. Generated users, roster rows, mappings and profiles cleaned.`,
    );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
