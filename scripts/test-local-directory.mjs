import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { chromium, expect } from '@playwright/test';
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
  const operations = path.resolve('scripts/admin-operations.mjs');
  const temp = await mkdtemp(path.join(os.tmpdir(), 'arkst-directory-'));
  const ids = {
    department: randomUUID(),
    sectionA: randomUUID(),
    sectionB: randomUUID(),
    outside: randomUUID(),
    auditFailureFunction: `test_directory_audit_failure_${tag}`,
    auditFailureTrigger: `test_directory_audit_failure_${tag}`,
    activityFailureFunction: `test_section_activity_failure_${tag}`,
    activityFailureTrigger: `test_section_activity_failure_${tag}`,
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
  async function operationCommand(
    command,
    operator,
    extra = [],
    expectSuccess = true,
  ) {
    try {
      const { stdout, stderr } = await exec(
        process.execPath,
        [
          operations,
          command,
          '--operator',
          operator.id,
          '--department',
          ids.department,
          ...extra,
        ],
        {
          env: {
            LOCAL_DATABASE_URL: config.databaseUrl,
            PATH: process.env.PATH,
            SystemRoot: process.env.SystemRoot,
          },
          timeout: 20000,
          maxBuffer: 1024 * 1024,
          windowsHide: true,
        },
      );
      if (!expectSuccess)
        throw new Error(`Expected ${command} to fail: ${stdout}${stderr}`);
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
    await responsibility(counselorA, 'teacher');
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
        const creationOptions = await api(placement, '/api/activities/options');
        assert.deepEqual(
          creationOptions.options
            .map((option) => [
              option.section_id,
              option.category_key,
              option.eligible_count,
            ])
            .sort(),
          [
            [ids.sectionA, 'general', 2],
            [ids.sectionB, 'general', 2],
          ].sort(),
        );
        assert.deepEqual(
          (await api(teacher, '/api/activities/options')).options,
          [],
        );
        assert.deepEqual(
          (await api(studentList[0], '/api/activities/options')).options,
          [],
        );
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

    let sectionActivity;
    let sectionAssignment;
    let unrosteredStudent;
    const sectionInput = (sectionIds, title, requiresVerification = true) => ({
      category: 'general',
      departmentScopeId: ids.department,
      sectionIds,
      title,
      description: 'Synthetic local section assignment',
      startsAt: new Date(Date.now() - 60000).toISOString(),
      deadlineAt: new Date(Date.now() + 3600000).toISOString(),
      endsAt: new Date(Date.now() + 7200000).toISOString(),
      requiresVerification,
    });
    await check(
      'approved creator snapshots Section A and Both from active roster without duplicate assignments',
      async () => {
        unrosteredStudent = await user('unrostered-student', 'student');
        const inactiveRoster = await user('inactive-roster', 'student');
        const missingMembership = await user('missing-membership', 'student');
        noDatabaseError(
          await admin.from('student_scope_memberships').insert({
            student_id: unrosteredStudent.id,
            scope_id: ids.sectionA,
          }),
          'provision membership without roster row',
        );
        noDatabaseError(
          await admin.from('student_scope_memberships').insert({
            student_id: inactiveRoster.id,
            scope_id: ids.sectionB,
          }),
          'provision inactive roster student membership',
        );
        await db.query(
          `insert into public.department_student_roster
            (department_scope_id,external_student_id,display_name,section_scope_id,linked_student_id,active,created_by)
            values($1,'UNLINKED-LOCAL','Unlinked local student',$2,null,true,$5),
              ($1,'INACTIVE-LOCAL','Inactive local student',$3,$6,false,$5),
              ($1,'NO-MEMBERSHIP','Missing membership',$2,$4,true,$5)`,
          [
            ids.department,
            ids.sectionA,
            ids.sectionB,
            missingMembership.id,
            operator.id,
            inactiveRoster.id,
          ],
        );
        const sectionA = await api(
          placement,
          '/api/activities/sections',
          sectionInput([ids.sectionA], 'Section A snapshot'),
          201,
        );
        assert.equal(sectionA.assignedCount, 2);
        assert.equal(sectionA.unlinkedRows, 1);
        assert.equal(sectionA.missingMembershipRows, 1);
        assert.equal(sectionA.rosterRows, 4);
        sectionActivity = await api(
          placement,
          '/api/activities/sections',
          sectionInput([ids.sectionA, ids.sectionB], 'Both sections snapshot'),
          201,
        );
        assert.equal(sectionActivity.assignedCount, 4);
        assert.equal(sectionActivity.unlinkedRows, 1);
        assert.equal(sectionActivity.inactiveRows, 1);
        assert.equal(sectionActivity.missingMembershipRows, 1);
        assert.equal(sectionActivity.rosterRows, 7);
        const ownList = await api(placement, '/api/activities/created');
        assert.equal(ownList.total, 2);
        assert.deepEqual(
          ownList.activities.map((item) => item.id).sort(),
          [sectionA.id, sectionActivity.id].sort(),
        );
        const summary = await api(
          placement,
          `/api/activities/${sectionActivity.id}/summary`,
        );
        assert.equal(summary.activity.title, 'Both sections snapshot');
        assert.equal(summary.activity.assignments, undefined);
        await api(
          teacher,
          `/api/activities/${sectionActivity.id}/summary`,
          undefined,
          404,
        );
        const assigned = await db.query(
          `select student_id,count(*)::int n from public.activity_assignments
            where activity_id=$1 group by student_id order by student_id`,
          [sectionActivity.id],
        );
        assert.deepEqual(
          assigned.rows.map((row) => row.student_id).sort(),
          studentList.map((student) => student.id).sort(),
        );
        assert.ok(assigned.rows.every((row) => row.n === 1));
        assert.equal(
          assigned.rows.some((row) => row.student_id === unrosteredStudent.id),
          false,
        );
        assert.equal(
          assigned.rows.some((row) => row.student_id === inactiveRoster.id),
          false,
        );
        assert.equal(
          assigned.rows.some((row) => row.student_id === missingMembership.id),
          false,
        );
        assert.equal(
          (
            await db.query(
              'select count(*)::int n from public.activity_target_sections where activity_id=$1',
              [sectionActivity.id],
            )
          ).rows[0].n,
          2,
        );
        const history = await db.query(
          `select action,count(*)::int n from public.activity_history
            where activity_id=$1 group by action`,
          [sectionActivity.id],
        );
        assert.equal(history.rows.find((row) => row.action === 'created').n, 1);
        assert.equal(
          history.rows.find((row) => row.action === 'assigned').n,
          4,
        );
      },
    );
    await check(
      'creator and counselor monitors use real assignments with bounded, scoped reads',
      async () => {
        const own = await api(
          placement,
          `/api/activities/${sectionActivity.id}/monitor`,
        );
        assert.equal(own.totalAssigned, 4);
        assert.equal(own.pending, 4);
        assert.equal(own.assignments.length, 4);
        assert.deepEqual(
          own.assignments.map((row) => row.studentIdentifier).sort(),
          ['051', '1042', '90001', 'S-A-17'],
        );
        sectionAssignment = own.assignments.find(
          (row) => row.studentId === studentList[0].id,
        ).assignmentId;
        const later = await api(
          placement,
          `/api/activities/${sectionActivity.id}/monitor?offset=2`,
        );
        assert.equal(later.totalAssigned, 4);
        assert.equal(later.assignments.length, 2);
        await api(
          placement,
          `/api/activities/${sectionActivity.id}/monitor?offset=10001`,
          undefined,
          400,
        );
        await api(
          teacher,
          `/api/activities/${sectionActivity.id}/monitor`,
          undefined,
          403,
        );
        const otherCreator = await user('other-section-creator');
        const otherResponsibility = await responsibility(
          otherCreator,
          'teacher',
        );
        noDatabaseError(
          await admin.from('activity_capabilities').insert({
            responsibility_id: otherResponsibility,
            category_key: 'general',
            can_create: true,
          }),
          'provision second creator without monitor ownership',
        );
        await api(
          otherCreator,
          `/api/activities/${sectionActivity.id}/monitor`,
          undefined,
          403,
        );
        await api(
          otherCreator,
          `/api/activities/${sectionActivity.id}`,
          undefined,
          404,
        );
        const otherList = await api(otherCreator, '/api/activities/created');
        assert.equal(otherList.total, 0);
        await api(
          counselorA,
          `/api/activities/${sectionActivity.id}/monitor`,
          undefined,
          403,
        );
        await api(
          studentList[0],
          `/api/activities/${sectionActivity.id}/monitor`,
          undefined,
          403,
        );
        await api(
          unrosteredStudent,
          `/api/activities/${sectionActivity.id}`,
          undefined,
          404,
        );
        await api(
          unrosteredStudent,
          `/api/activity-assignments/${sectionAssignment}/submit`,
          {},
          403,
        );
        noDatabaseError(
          await admin
            .from('profiles')
            .update({ is_active: false })
            .eq('id', studentList[3].id),
          'temporarily deactivate assigned synthetic student',
        );
        try {
          const inactive = await studentList[3].browser.request(
            `/api/activities/${sectionActivity.id}`,
          );
          assert.equal(inactive.status, 403);
        } finally {
          noDatabaseError(
            await admin
              .from('profiles')
              .update({ is_active: true })
              .eq('id', studentList[3].id),
            'reactivate synthetic student',
          );
        }
        const forA = await api(counselorA, '/api/counselor/activities');
        const forB = await api(counselorB, '/api/counselor/activities');
        assert.deepEqual(
          forA.assignments
            .filter((row) => row.activityId === sectionActivity.id)
            .map((row) => row.studentIdentifier)
            .sort(),
          ['1042', '90001', 'S-A-17'],
        );
        assert.deepEqual(
          forB.assignments
            .filter((row) => row.activityId === sectionActivity.id)
            .map((row) => row.studentIdentifier),
          ['051'],
        );
        assert.equal(
          new Set(forA.assignments.map((row) => row.assignmentId)).size,
          forA.assignments.length,
        );
        assert.equal(
          (await api(teacher, '/api/counselor/activities')).total,
          0,
        );
        deniedRead(
          await placement.client.from('department_student_roster').select('*'),
        );
        deniedRead(
          await placement.client.from('activity_target_sections').select('*'),
        );
        const placementCapability = await db.query(
          `select c.responsibility_id from public.activity_capabilities c
            join public.responsibility_assignments r on r.id=c.responsibility_id
            where r.user_id=$1 and c.category_key='general' and c.can_create`,
          [placement.id],
        );
        assert.equal(placementCapability.rows.length, 1);
        await db.query(
          'delete from public.activity_capabilities where responsibility_id=$1 and category_key=$2',
          [placementCapability.rows[0].responsibility_id, 'general'],
        );
        try {
          await api(
            placement,
            `/api/activities/${sectionActivity.id}/monitor`,
            undefined,
            403,
          );
        } finally {
          await db.query(
            `insert into public.activity_capabilities
              (responsibility_id,category_key,can_create,can_verify)
              values($1,'general',true,false)`,
            [placementCapability.rows[0].responsibility_id],
          );
        }
      },
    );
    await check(
      'assigned student reports once; creator and counselor see pending verification; explicit reviewer verifies',
      async () => {
        await api(
          studentList[1],
          `/api/activity-assignments/${sectionAssignment}/submit`,
          {},
          403,
        );
        await api(
          studentList[0],
          `/api/activity-assignments/${sectionAssignment}/submit`,
          {},
        );
        await api(
          studentList[0],
          `/api/activity-assignments/${sectionAssignment}/submit`,
          {},
          409,
        );
        let own = await api(
          placement,
          `/api/activities/${sectionActivity.id}/monitor`,
        );
        assert.equal(own.awaitingVerification, 1);
        assert.equal(own.verified, 0);
        assert.equal(own.pending, 3);
        assert.equal(
          (await api(counselorA, '/api/counselor/activities')).assignments.find(
            (row) => row.assignmentId === sectionAssignment,
          ).state,
          'reported',
        );
        await api(
          placement,
          `/api/activity-assignments/${sectionAssignment}/verify`,
          {},
          403,
        );
        const reviewer = await user('section-reviewer');
        const reviewerResponsibility = await responsibility(
          reviewer,
          'teacher',
        );
        noDatabaseError(
          await admin.from('activity_capabilities').insert({
            responsibility_id: reviewerResponsibility,
            category_key: 'general',
            can_verify: true,
          }),
          'provision explicit department verification capability',
        );
        await api(
          reviewer,
          `/api/activity-assignments/${sectionAssignment}/verify`,
          {},
        );
        own = await api(
          placement,
          `/api/activities/${sectionActivity.id}/monitor`,
        );
        assert.equal(own.awaitingVerification, 0);
        assert.equal(own.verified, 1);
        const fresh = new AppBrowser(config.appOrigin);
        await fresh.login(studentList[0]);
        const reloaded = await fresh.request(
          `/api/activities/${sectionActivity.id}`,
        );
        assert.equal(reloaded.status, 200);
        const activity = (await reloaded.json()).activity;
        assert.equal(
          activity.assignments.find((row) => row.id === sectionAssignment)
            .completion.state,
          'verified',
        );
        assert.equal(
          (
            await db.query(
              'select count(*)::int n from public.activity_completions where assignment_id=$1',
              [sectionAssignment],
            )
          ).rows[0].n,
          1,
        );
        const concurrentAssignment = own.assignments.find(
          (row) => row.studentId === studentList[2].id,
        ).assignmentId;
        const raced = await Promise.all([
          studentList[2].client.rpc('submit_activity', {
            p_assignment: concurrentAssignment,
          }),
          studentList[2].client.rpc('submit_activity', {
            p_assignment: concurrentAssignment,
          }),
        ]);
        assert.equal(raced.filter((response) => !response.error).length, 1);
        assert.equal(
          raced.filter((response) => response.error?.code === '23505').length,
          1,
        );
        assert.equal(
          (
            await db.query(
              'select count(*)::int n from public.activity_completions where assignment_id=$1',
              [concurrentAssignment],
            )
          ).rows[0].n,
          1,
        );
      },
    );
    await check(
      'invalid targets and dates, unauthorized creator, and database failure leave no partial activity',
      async () => {
        await api(
          teacher,
          '/api/activities/sections',
          sectionInput([ids.sectionA], 'Unauthorized section'),
          403,
        );
        await api(
          studentList[0],
          '/api/activities/sections',
          sectionInput([ids.sectionA], 'Student section'),
          403,
        );
        await api(
          placement,
          '/api/activities/sections',
          sectionInput([ids.outside], 'Outside section'),
          400,
        );
        await api(
          placement,
          '/api/activities/sections',
          sectionInput([ids.sectionA, ids.sectionA], 'Duplicate section'),
          400,
        );
        const badDate = sectionInput([ids.sectionA], 'Bad date');
        badDate.deadlineAt = badDate.startsAt;
        await api(placement, '/api/activities/sections', badDate, 400);
        await api(
          placement,
          '/api/activities/sections',
          {
            ...sectionInput([ids.sectionA], 'No manual targets'),
            studentIds: [studentList[0].id],
          },
          400,
        );
        await db.query(
          `create function public.${ids.activityFailureFunction}() returns trigger
             language plpgsql as $$ begin if new.action='created' and new.activity_id in
               (select id from public.activities where title='Forced section history failure')
               then raise exception 'synthetic history failure'; end if; return new; end $$`,
        );
        await db.query(
          `create trigger ${ids.activityFailureTrigger} before insert on public.activity_history
            for each row execute function public.${ids.activityFailureFunction}()`,
        );
        try {
          await api(
            placement,
            '/api/activities/sections',
            sectionInput([ids.sectionA], 'Forced section history failure'),
            503,
          );
        } finally {
          await db.query(
            `drop trigger if exists ${ids.activityFailureTrigger} on public.activity_history`,
          );
          await db.query(
            `drop function if exists public.${ids.activityFailureFunction}()`,
          );
        }
        assert.equal(
          (
            await db.query(
              `select count(*)::int n from public.activities
                 where created_by=$1 and title='Forced section history failure'`,
              [placement.id],
            )
          ).rows[0].n,
          0,
        );
      },
    );
    await check(
      'empty active section roster reports zero eligible options and rejects zero-assignment publication',
      async () => {
        await db.query(
          'update public.department_student_roster set active=false where department_scope_id=$1 and section_scope_id=$2',
          [ids.department, ids.sectionA],
        );
        try {
          const options = await api(placement, '/api/activities/options');
          assert.equal(
            options.options.find((row) => row.section_id === ids.sectionA)
              .eligible_count,
            0,
          );
          const browser = await chromium.launch({
            channel: 'msedge',
            headless: true,
          });
          try {
            const page = await browser.newPage();
            await page.goto(`${config.appOrigin}/login`);
            await page.getByLabel('Email').fill(placement.email);
            await page.getByLabel('Password').fill(placement.password);
            await page
              .getByRole('button', { name: 'Sign in to local Supabase' })
              .click();
            await page.goto(`${config.appOrigin}/dashboard/faculty`);
            const createForm = page.locator(
              'section[aria-labelledby="create-heading"]',
            );
            await expect(
              createForm.getByRole('checkbox', { name: /Section A/ }),
            ).toBeVisible();
            await createForm
              .getByRole('checkbox', { name: /Section A/ })
              .check();
            await expect(createForm.locator('.dashboard-alert')).toContainText(
              'No eligible students',
            );
            await expect(
              createForm.getByRole('button', {
                name: 'Publish to selected sections',
              }),
            ).toBeDisabled();
          } finally {
            await browser.close();
          }
          await api(
            placement,
            '/api/activities/sections',
            sectionInput([ids.sectionA], 'Empty section publication'),
            400,
          );
          assert.equal(
            (
              await db.query(
                "select count(*)::int n from public.activities where created_by=$1 and title='Empty section publication'",
                [placement.id],
              )
            ).rows[0].n,
            0,
          );
        } finally {
          await db.query(
            'update public.department_student_roster set active=true where department_scope_id=$1 and section_scope_id=$2',
            [ids.department, ids.sectionA],
          );
        }
      },
    );
    await check(
      'protected dashboard shells follow real identity and one staff account can navigate both faculty and counselor views',
      async () => {
        const anonymous = new AppBrowser(config.appOrigin);
        const denied = await anonymous.request('/dashboard/student');
        assert.equal(denied.status, 307);
        assert.equal(
          new URL(denied.headers.get('location'), config.appOrigin).pathname,
          '/login',
        );
        const studentPage =
          await studentList[0].browser.request('/dashboard/student');
        assert.equal(studentPage.status, 200);
        assert.match(await studentPage.text(), /My activities/);
        const facultyPage =
          await placement.browser.request('/dashboard/faculty');
        assert.equal(facultyPage.status, 200);
        assert.match(await facultyPage.text(), /Create one activity/);
        const counselorPage = await counselorA.browser.request(
          '/dashboard/counselor',
        );
        assert.equal(counselorPage.status, 200);
        const counselorHtml = await counselorPage.text();
        assert.match(counselorHtml, /My counseling students/);
        assert.match(counselorHtml, /Faculty activities/);
        assert.match(counselorHtml, /Counselor view/);
      },
    );
    await check(
      'explicit category approvals expose the same shared section Activity engine for academic categories',
      async () => {
        const categoryCreator = await user('category-creator');
        const responsibilityId = await responsibility(
          categoryCreator,
          'teacher',
        );
        const categories = [
          'assignment',
          'weekly_test',
          'nptel',
          'placement',
          'seminar',
          'mini_project',
        ];
        noDatabaseError(
          await admin.from('activity_capabilities').insert(
            categories.map((category) => ({
              responsibility_id: responsibilityId,
              category_key: category,
              can_create: true,
            })),
          ),
          'approve synthetic categories independently',
        );
        const options = await api(categoryCreator, '/api/activities/options');
        assert.deepEqual(
          [...new Set(options.options.map((row) => row.category_key))].sort(),
          categories.sort(),
        );
        assert.equal(options.options.length, categories.length * 2);
        const input = sectionInput(
          [ids.sectionA, ids.sectionB],
          'Synthetic NPTEL section activity',
        );
        input.category = 'nptel';
        const created = await api(
          categoryCreator,
          '/api/activities/sections',
          input,
          201,
        );
        assert.equal(created.assignedCount, 4);
        assert.equal(
          (
            await db.query(
              'select category_key from public.activities where id=$1',
              [created.id],
            )
          ).rows[0].category_key,
          'nptel',
        );
      },
    );
    await check(
      'real Edge browser publishes one Both activity, persists student completion, and shows creator/counselor results',
      async () => {
        const browser = await chromium.launch({
          channel: 'msedge',
          headless: true,
        });
        const title = `Browser both-section activity ${tag}`;
        async function browserLogin(context, person) {
          const page = await context.newPage();
          await page.goto(`${config.appOrigin}/login`);
          await page.getByLabel('Email').fill(person.email);
          await page.getByLabel('Password').fill(person.password);
          await page
            .getByRole('button', { name: 'Sign in to local Supabase' })
            .click();
          await expect(page).toHaveURL(`${config.appOrigin}/profile`);
          return page;
        }
        try {
          const anonymous = await browser.newContext();
          const anonymousPage = await anonymous.newPage();
          await anonymousPage.goto(`${config.appOrigin}/dashboard/student`);
          await expect(anonymousPage).toHaveURL(`${config.appOrigin}/login`);
          await anonymous.close();

          const facultyContext = await browser.newContext({
            viewport: { width: 1280, height: 820 },
          });
          const facultyPage = await browserLogin(facultyContext, placement);
          await facultyPage.goto(`${config.appOrigin}/dashboard/faculty`);
          const createForm = facultyPage.locator(
            'section[aria-labelledby="create-heading"]',
          );
          await expect(
            facultyPage.getByRole('heading', { name: 'Create one activity' }),
          ).toBeVisible();
          await expect(createForm.getByText('2 eligible now')).toHaveCount(2);
          await createForm.getByRole('checkbox', { name: /Section A/ }).focus();
          await facultyPage.keyboard.press('Space');
          await expect(
            createForm.getByRole('checkbox', { name: /Section A/ }),
          ).toBeChecked();
          await createForm.getByRole('checkbox', { name: /Section B/ }).check();
          await createForm.getByRole('textbox', { name: 'Title' }).fill(title);
          await createForm
            .getByRole('textbox', { name: 'Description' })
            .fill('Real browser test instructions');
          const dates = await facultyPage.evaluate(() => {
            const local = (delta) => {
              const date = new Date(Date.now() + delta);
              return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
                .toISOString()
                .slice(0, 16);
            };
            return {
              start: local(-120000),
              deadline: local(3600000),
              end: local(7200000),
            };
          });
          await createForm.locator('input[name="startsAt"]').fill(dates.start);
          await createForm
            .locator('input[name="deadlineAt"]')
            .fill(dates.deadline);
          await createForm.locator('input[name="endsAt"]').fill(dates.end);
          await createForm
            .getByRole('checkbox', {
              name: /Require authorized staff verification/,
            })
            .check();
          const capability = await db.query(
            `select c.responsibility_id from public.activity_capabilities c
             join public.responsibility_assignments r on r.id=c.responsibility_id
             where r.user_id=$1 and c.category_key='general' and c.can_create`,
            [placement.id],
          );
          assert.equal(capability.rows.length, 1);
          await db.query(
            "delete from public.activity_capabilities where responsibility_id=$1 and category_key='general'",
            [capability.rows[0].responsibility_id],
          );
          try {
            await createForm
              .getByRole('button', { name: 'Publish to selected sections' })
              .click();
            await expect(createForm.locator('.dashboard-alert')).toContainText(
              'not permitted',
            );
            await expect(
              createForm.getByRole('textbox', { name: 'Title' }),
            ).toHaveValue(title);
            assert.equal(
              (
                await db.query(
                  'select count(*)::int n from public.activities where created_by=$1 and title=$2',
                  [placement.id, title],
                )
              ).rows[0].n,
              0,
            );
          } finally {
            await db.query(
              `insert into public.activity_capabilities(responsibility_id,category_key,can_create,can_verify)
               values($1,'general',true,false)
               on conflict(responsibility_id,category_key) do update set can_create=true`,
              [capability.rows[0].responsibility_id],
            );
          }
          await createForm
            .getByRole('button', { name: 'Refresh options' })
            .click();
          await expect(
            createForm.getByRole('button', {
              name: 'Publish to selected sections',
            }),
          ).toBeEnabled();
          await createForm
            .locator('form.dashboard-form button[type="submit"]')
            .evaluate((button) => {
              button.click();
              button.click();
            });
          await expect(createForm.locator('.dashboard-notice')).toContainText(
            'Saved one activity with 4 assigned students',
          );
          const createdRows = await db.query(
            'select id from public.activities where created_by=$1 and title=$2',
            [placement.id, title],
          );
          assert.equal(
            createdRows.rows.length,
            1,
            'double click must publish only once',
          );
          const browserActivityId = createdRows.rows[0].id;
          assert.equal(
            (
              await db.query(
                'select count(*)::int n from public.activity_assignments where activity_id=$1',
                [browserActivityId],
              )
            ).rows[0].n,
            4,
          );
          await facultyPage
            .getByRole('link', { name: 'Open completion results' })
            .click();
          await expect(
            facultyPage.getByRole('heading', { name: title }),
          ).toBeVisible();
          await expect(
            facultyPage.getByLabel('Completion totals'),
          ).toContainText('4');
          assert.equal(
            await facultyPage.getByRole('button', { name: /Verify/ }).count(),
            0,
          );

          const studentContext = await browser.newContext({
            viewport: { width: 390, height: 844 },
            isMobile: true,
            hasTouch: true,
          });
          const studentPage = await browserLogin(
            studentContext,
            studentList[0],
          );
          await studentPage.goto(`${config.appOrigin}/dashboard/student`);
          const studentCard = studentPage
            .locator('.dashboard-card')
            .filter({ hasText: title });
          await expect(studentCard).toBeVisible();
          assert.equal(
            await studentPage.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
            true,
            'mobile page must not overflow horizontally',
          );
          const studentAssignment = await db.query(
            'select id from public.activity_assignments where activity_id=$1 and student_id=$2',
            [browserActivityId, studentList[0].id],
          );
          assert.equal(studentAssignment.rows.length, 1);
          await studentCard
            .getByRole('button', { name: 'Report completion' })
            .evaluate((button) => {
              button.click();
              button.click();
            });
          await expect(studentPage.getByRole('status')).toContainText(
            'Saved status reloaded',
          );
          assert.equal(
            (
              await db.query(
                'select count(*)::int n from public.activity_completions where assignment_id=$1',
                [studentAssignment.rows[0].id],
              )
            ).rows[0].n,
            1,
          );
          await studentPage.reload();
          await expect(
            studentPage.locator('.dashboard-card').filter({ hasText: title }),
          ).toContainText('Awaiting verification');
          await studentPage
            .locator('.dashboard-card')
            .filter({ hasText: title })
            .getByRole('button', { name: 'View my history' })
            .click();
          await expect(
            studentPage
              .locator('.dashboard-card')
              .filter({ hasText: title })
              .getByRole('region', { name: `History for ${title}` }),
          ).toContainText('reported');

          await facultyPage
            .getByRole('button', { name: 'Refresh results' })
            .click();
          await expect(
            facultyPage.getByLabel('Completion totals'),
          ).toContainText('Awaiting verification');
          await expect(
            facultyPage
              .locator('.dashboard-list-row')
              .filter({ hasText: '1042' }),
          ).toContainText('Awaiting verification');

          const counselorContext = await browser.newContext({
            viewport: { width: 1280, height: 820 },
          });
          const counselorPage = await browserLogin(
            counselorContext,
            counselorA,
          );
          await counselorPage.goto(`${config.appOrigin}/dashboard/counselor`);
          await expect(
            counselorPage.getByRole('heading', {
              name: 'My counseling students',
            }),
          ).toBeVisible();
          await expect(
            counselorPage.locator('.dashboard-roster li'),
          ).toHaveCount(3);
          await expect(
            counselorPage
              .locator('.dashboard-list-row')
              .filter({ hasText: title })
              .filter({ hasText: '1042' }),
          ).toContainText('Awaiting verification');
          await expect(
            counselorPage.getByRole('link', { name: 'Faculty activities' }),
          ).toBeVisible();

          const studentBContext = await browser.newContext({
            viewport: { width: 390, height: 844 },
            isMobile: true,
          });
          await browserLogin(studentBContext, studentList[1]);
          const otherView = await studentBContext.request.get(
            `${config.appOrigin}/api/activities/${browserActivityId}`,
          );
          assert.equal(otherView.status(), 200);
          const otherBody = await otherView.json();
          assert.deepEqual(
            otherBody.activity.assignments.map((row) => row.student_id),
            [studentList[1].id],
          );
          const forbidden = await studentBContext.request.post(
            `${config.appOrigin}/api/activity-assignments/${studentAssignment.rows[0].id}/submit`,
            {
              headers: {
                Origin: config.appOrigin,
                'Content-Type': 'application/json',
              },
              data: {},
            },
          );
          assert.equal(forbidden.status(), 403);
        } finally {
          await browser.close();
        }
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
        const oldActivityAccess = await api(
          counselorA,
          '/api/counselor/activities',
        );
        const newActivityAccess = await api(
          counselorB,
          '/api/counselor/activities',
        );
        assert.equal(
          oldActivityAccess.assignments.some(
            (row) =>
              row.activityId === sectionActivity.id &&
              row.studentIdentifier === '1042',
          ),
          false,
        );
        assert.equal(
          newActivityAccess.assignments.some(
            (row) =>
              row.activityId === sectionActivity.id &&
              row.studentIdentifier === '1042',
          ),
          true,
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
          (await api(counselorA, '/api/counselor/activities')).assignments.some(
            (row) => row.studentIdentifier === '90001',
          ),
          false,
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
    const futureStudent = await user(
      'approved-future-student',
      'student',
      false,
    );
    await check(
      'approved roster email links an existing confirmed Auth student without public signup',
      async () => {
        const file = await writeCsv(
          'approved-student.csv',
          `student_identifier,display_name,section_scope_id,linked_student_id,institutional_email\nNEW-71,Approved Student,${ids.sectionA},,${futureStudent.email}\n`,
        );
        await adminCommand('import-roster', operator, [
          '--file',
          file,
          '--apply',
        ]);
        const argumentsForStudent = [
          '--user',
          futureStudent.id,
          '--student',
          'NEW-71',
          '--email',
          futureStudent.email,
        ];
        assert.match(
          await adminCommand(
            'provision-student',
            operator,
            argumentsForStudent,
          ),
          /PREVIEW ONLY/,
        );
        assert.equal(
          (
            await db.query(
              'select count(*)::int n from public.profiles where id=$1',
              [futureStudent.id],
            )
          ).rows[0].n,
          0,
        );
        assert.match(
          await adminCommand(
            'provision-student',
            deniedOperator,
            argumentsForStudent,
            false,
          ),
          /must be an active staff member/,
        );
        assert.match(
          await adminCommand(
            'provision-student',
            operator,
            [...argumentsForStudent, '--email', 'wrong@example.test'],
            false,
          ),
          /must be a UUID|requires|matching Auth email|requires --user|requires --user UUID|Approved unlinked roster/,
        );
        await adminCommand('provision-student', operator, [
          ...argumentsForStudent,
          '--apply',
        ]);
        noDatabaseError(
          await futureStudent.client.auth.signInWithPassword({
            email: futureStudent.email,
            password: futureStudent.password,
          }),
          'approved student Auth sign-in',
        );
        await futureStudent.browser.login(futureStudent);
        assert.equal(
          (await api(futureStudent, '/api/me')).profile.id,
          futureStudent.id,
        );
        assert.equal(
          (
            await db.query(
              'select count(*)::int n from public.student_scope_memberships where student_id=$1 and scope_id=$2',
              [futureStudent.id, ids.sectionA],
            )
          ).rows[0].n,
          1,
        );
        assert.match(
          await adminCommand(
            'provision-student',
            operator,
            [...argumentsForStudent, '--apply'],
            false,
          ),
          /Approved unlinked roster/,
        );
      },
    );
    await check(
      'roster corrections update identifiers and names atomically without changing assignments or identity',
      async () => {
        const correction = await writeCsv(
          'roster-correction.csv',
          `student_identifier,new_student_identifier,display_name,institutional_email\nNEW-71,NEW-0071,Corrected Student,${futureStudent.email}\n`,
        );
        assert.match(
          await adminCommand('update-roster', operator, ['--file', correction]),
          /PREVIEW ONLY/,
        );
        assert.equal(
          (
            await db.query(
              'select external_student_id from public.department_student_roster where linked_student_id=$1',
              [futureStudent.id],
            )
          ).rows[0].external_student_id,
          'NEW-71',
        );
        await adminCommand('update-roster', operator, [
          '--file',
          correction,
          '--apply',
        ]);
        const updated = (
          await db.query(
            'select external_student_id,display_name,linked_student_id from public.department_student_roster where linked_student_id=$1',
            [futureStudent.id],
          )
        ).rows[0];
        assert.equal(updated.external_student_id, 'NEW-0071');
        assert.equal(updated.display_name, 'Corrected Student');
        assert.equal(
          (
            await db.query(
              'select display_name from public.profiles where id=$1',
              [futureStudent.id],
            )
          ).rows[0].display_name,
          'Corrected Student',
        );
        const duplicate = await writeCsv(
          'roster-duplicate-correction.csv',
          `student_identifier,new_student_identifier,display_name,institutional_email\nNEW-0071,1042,Wrong,${futureStudent.email}\n`,
        );
        assert.match(
          await adminCommand(
            'update-roster',
            operator,
            ['--file', duplicate, '--apply'],
            false,
          ),
          /duplicate key/,
        );
        assert.equal(
          (
            await db.query(
              'select external_student_id from public.department_student_roster where linked_student_id=$1',
              [futureStudent.id],
            )
          ).rows[0].external_student_id,
          'NEW-0071',
        );
        assert.match(
          await adminCommand(
            'update-roster',
            deniedOperator,
            ['--file', correction],
            false,
          ),
          /must be an active staff member/,
        );
        assert.equal(
          (
            await db.query(
              "select count(*)::int n from public.department_directory_audit where entity_type='student_roster' and action='updated' and entity_id=$1",
              [
                (
                  await db.query(
                    'select id from public.department_student_roster where linked_student_id=$1',
                    [futureStudent.id],
                  )
                ).rows[0].id,
              ],
            )
          ).rows[0].n,
          1,
        );
      },
    );
    await check(
      'trusted ordinary responsibility, Activity grants and escalation routes are configurable and revocable',
      async () => {
        const assignment = [
          '--user',
          teacher.id,
          '--role',
          'coordinator',
          '--scope',
          ids.department,
        ];
        assert.match(
          await operationCommand('assign-responsibility', operator, assignment),
          /PREVIEW ONLY/,
        );
        assert.match(
          await operationCommand(
            'assign-responsibility',
            deniedOperator,
            [...assignment, '--apply'],
            false,
          ),
          /administrator approval/,
        );
        assert.match(
          await operationCommand(
            'assign-responsibility',
            operator,
            [
              '--user',
              teacher.id,
              '--role',
              'hod',
              '--scope',
              ids.department,
              '--apply',
            ],
            false,
          ),
          /approved ordinary role/,
        );
        await operationCommand('assign-responsibility', operator, [
          ...assignment,
          '--apply',
        ]);
        const added = (
          await db.query(
            "select id from public.responsibility_assignments where user_id=$1 and role='coordinator' and scope_id=$2 and ends_at is null",
            [teacher.id, ids.department],
          )
        ).rows[0].id;
        const grant = [
          '--responsibility',
          added,
          '--category',
          'weekly_test',
          '--create',
          'true',
          '--verify',
          'false',
        ];
        assert.match(
          await operationCommand('grant-activity', operator, grant),
          /PREVIEW ONLY/,
        );
        await operationCommand('grant-activity', operator, [
          ...grant,
          '--apply',
        ]);
        assert.ok(
          (await api(teacher, '/api/activities/options')).options.some(
            (row) => row.category_key === 'weekly_test',
          ),
        );
        const route = [
          '--section',
          ids.sectionA,
          '--role',
          'coordinator',
          '--responsibility',
          added,
        ];
        await operationCommand('set-route', operator, [...route, '--apply']);
        assert.equal(
          (
            await db.query(
              'select count(*)::int n from public.escalation_routes where section_scope_id=$1 and target_role=$2 and responsibility_id=$3 and active',
              [ids.sectionA, 'coordinator', added],
            )
          ).rows[0].n,
          1,
        );
        assert.match(
          await operationCommand(
            'end-responsibility',
            operator,
            ['--responsibility', added, '--apply'],
            false,
          ),
          /routes or open cases/,
        );
        await operationCommand('set-route', operator, [
          '--section',
          ids.sectionA,
          '--role',
          'coordinator',
          '--responsibility',
          'none',
          '--apply',
        ]);
        await operationCommand('end-responsibility', operator, [
          '--responsibility',
          added,
          '--apply',
        ]);
        assert.ok(
          !(await api(teacher, '/api/activities/options')).options.some(
            (row) => row.category_key === 'weekly_test',
          ),
        );
        assert.equal(
          (
            await db.query(
              'select count(*)::int n from public.trusted_operator_history where actor_id=$1 and entity_id=$2',
              [operator.id, added],
            )
          ).rows[0].n,
          3,
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
          `drop trigger if exists ${ids.activityFailureTrigger} on public.activity_history; drop function if exists public.${ids.activityFailureFunction}();`,
        );
        await db.query(
          `drop trigger if exists ${ids.auditFailureTrigger} on public.department_directory_audit; drop function if exists public.${ids.auditFailureFunction}();`,
        );
        await db.query(
          'delete from public.activities where created_by=any($1::uuid[]) and scope_id=any($2::uuid[])',
          [
            users.map((x) => x.id),
            [ids.department, ids.sectionA, ids.sectionB],
          ],
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
          'delete from public.trusted_operator_history where actor_id=any($1::uuid[])',
          [users.map((x) => x.id)],
        );
        await db.query(
          'delete from public.escalation_routes where section_scope_id=any($1::uuid[])',
          [[ids.sectionA, ids.sectionB]],
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
