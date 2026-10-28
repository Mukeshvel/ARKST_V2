import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { chromium, expect } from '@playwright/test';
import {
  AppBrowser,
  localFetch,
  localTestConfiguration,
  noDatabaseError,
} from '../tests/integration/local-helpers.mjs';
const execute = promisify(execFile);

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
    query_timeout: 20000,
  });
  const ids = {
    department: randomUUID(),
    sectionA: randomUUID(),
    sectionB: randomUUID(),
    outside: randomUUID(),
    outsideSection: randomUUID(),
  };
  const people = [];
  const failures = [];
  let connected = false,
    passed = 0,
    activity,
    announcement,
    schedule,
    blackout,
    group,
    nptel;
  async function check(label, action) {
    await action();
    console.log(`PASS ${++passed}: ${label}`);
  }
  async function person(label, kind = 'student') {
    const p = {
      email: `arkst-s2-${tag}-${label}@example.test`,
      password: `T!${randomBytes(24).toString('base64url')}`,
    };
    p.id = noDatabaseError(
      await admin.auth.admin.createUser({ ...p, email_confirm: true }),
      'create synthetic Auth user',
    ).user.id;
    people.push(p);
    noDatabaseError(
      await admin.from('profiles').insert({
        id: p.id,
        display_name: `Session2 ${label}`,
        account_kind: kind,
        staff_classification: kind === 'staff' ? 'teaching' : null,
        is_active: true,
      }),
      'provision synthetic profile',
    );
    p.client = createClient(config.supabaseOrigin, config.publicKey, options);
    noDatabaseError(
      await p.client.auth.signInWithPassword({
        email: p.email,
        password: p.password,
      }),
      'real synthetic sign-in',
    );
    p.browser = new AppBrowser(config.appOrigin);
    await p.browser.login(p);
    return p;
  }
  async function api(p, path, body, expected = 200) {
    const response = await p.browser.request(
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
    const result = await response.json();
    assert.equal(
      response.status,
      expected,
      `${path}: HTTP ${response.status}, ${result.error ?? 'no error'}`,
    );
    return result;
  }
  async function sql(query, values = []) {
    return (await db.query(query, values)).rows;
  }
  function day(base, offset) {
    const d = new Date(`${base}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  }
  function kolkata(date, time) {
    return new Date(`${date}T${time}:00+05:30`).toISOString();
  }
  const calendarParts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value]),
  );
  const current = `${calendarParts.year}-${calendarParts.month}-${calendarParts.day}`;
  const weekday = new Date(`${current}T00:00:00Z`).getUTCDay();
  const monday = day(current, (8 - weekday) % 7 || 7);
  const slots = [
    [1, 0, 0, 2],
    [2, 0, 3, 5],
    [3, 1, 0, 1],
    [4, 1, 2, 3],
    [5, 1, 4, 5],
  ];
  try {
    await db.connect();
    connected = true;
    await sql(
      "insert into public.scopes(id,name,kind) values($1,$2,'department'),($3,$4,'department')",
      [ids.department, `Session2 ${tag}`, ids.outside, `Outside ${tag}`],
    );
    await sql(
      "insert into public.scopes(id,name,kind,parent_id) values($1,'A','section',$4),($2,'B','section',$4),($3,'Outside','section',$5)",
      [
        ids.sectionA,
        ids.sectionB,
        ids.outsideSection,
        ids.department,
        ids.outside,
      ],
    );
    const operator = await person('operator', 'staff');
    const noGrant = await person('no-grant', 'staff');
    const studentA = await person('student-a');
    const studentB = await person('student-b');
    const outsideStudent = await person('outside-student');
    const resp = (
      await sql(
        "insert into public.responsibility_assignments(user_id,role,scope_id,starts_at) values($1,'coordinator',$2,now()-interval '1 day') returning id",
        [operator.id, ids.department],
      )
    )[0].id;
    await sql(
      "insert into public.activity_capabilities(responsibility_id,category_key,can_create) values($1,'general',true),($1,'weekly_test',true),($1,'nptel',true)",
      [resp],
    );
    await sql(
      'insert into public.department_operation_capabilities(responsibility_id,can_manage_groups,can_manage_calendar,can_supervise) values($1,true,true,true)',
      [resp],
    );
    const noResp = (
      await sql(
        "insert into public.responsibility_assignments(user_id,role,scope_id,starts_at) values($1,'teacher',$2,now()-interval '1 day') returning id",
        [noGrant.id, ids.department],
      )
    )[0].id;
    await sql(
      "insert into public.activity_capabilities(responsibility_id,category_key,can_create) values($1,'general',true)",
      [noResp],
    );
    for (const [p, dept, section, roll] of [
      [studentA, ids.department, ids.sectionA, 'A-17'],
      [studentB, ids.department, ids.sectionB, 'B-92'],
      [outsideStudent, ids.outside, ids.outsideSection, 'X-401'],
    ]) {
      await sql(
        'insert into public.department_student_roster(department_scope_id,section_scope_id,external_student_id,display_name,linked_student_id,created_by) values($1,$2,$3,$4,$5,$6)',
        [dept, section, `${roll}-${tag}`, `Student ${roll}`, p.id, operator.id],
      );
      await sql(
        'insert into public.student_scope_memberships(student_id,scope_id) values($1,$2)',
        [p.id, section],
      );
    }
    await check(
      'explicit group grant permits creation; profile roles alone do not',
      async () => {
        assert.equal(
          (await api(noGrant, '/api/department-operations')).departments.length,
          0,
        );
        assert.equal(
          (
            await api(
              studentA,
              '/api/groups',
              { departmentId: ids.department, name: 'Denied', type: 'Custom' },
              403,
            )
          ).error.length > 0,
          true,
        );
        assert.equal(
          (
            await api(
              noGrant,
              '/api/groups',
              { departmentId: ids.department, name: 'Denied', type: 'Custom' },
              403,
            )
          ).error.length > 0,
          true,
        );
        group = (
          await api(
            operator,
            '/api/groups',
            {
              departmentId: ids.department,
              name: `RHP ${tag}`,
              type: 'Custom',
            },
            201,
          )
        ).id;
        assert.ok(group);
        assert.equal(
          (await api(operator, `/api/groups?department=${ids.department}`))
            .groups.length,
          1,
        );
        await api(
          operator,
          '/api/groups',
          { departmentId: ids.outside, name: 'Cross', type: 'Custom' },
          403,
        );
      },
    );
    await check(
      'group membership validates scope, rejects duplicates, and records actor history',
      async () => {
        await api(operator, `/api/groups/${group}/members`, {
          studentId: studentA.id,
          add: true,
        });
        await api(operator, `/api/groups/${group}/members`, {
          studentId: studentB.id,
          add: true,
        });
        await api(
          operator,
          `/api/groups/${group}/members`,
          { studentId: studentA.id, add: true },
          409,
        );
        await api(
          operator,
          `/api/groups/${group}/members`,
          { studentId: outsideStudent.id, add: true },
          403,
        );
        await api(noGrant, `/api/groups/${group}/students`, undefined, 403);
        const roster = await api(operator, `/api/groups/${group}/students`);
        assert.equal(roster.students.filter((x) => x.member).length, 2);
        const history = await api(operator, `/api/groups/${group}/history`);
        assert.equal(history.total, 2);
        assert.ok(history.events.every((x) => x.actorId === operator.id));
      },
    );
    await check(
      'group Activity snapshots unique assignments; later member removal cannot change them',
      async () => {
        activity = (
          await api(
            operator,
            `/api/groups/${group}/activities`,
            {
              category: 'general',
              title: `Group Activity ${tag}`,
              description: 'Synthetic external work',
              startsAt: new Date(Date.now() - 60000).toISOString(),
              deadlineAt: new Date(Date.now() + 3600000).toISOString(),
              endsAt: new Date(Date.now() + 7200000).toISOString(),
              requiresVerification: false,
            },
            201,
          )
        ).id;
        assert.equal(
          (
            await sql(
              'select count(*)::integer n from public.activity_assignments where activity_id=$1',
              [activity],
            )
          )[0].n,
          2,
        );
        await api(operator, `/api/groups/${group}/members`, {
          studentId: studentB.id,
          add: false,
        });
        assert.equal(
          (
            await sql(
              'select count(*)::integer n from public.activity_assignments where activity_id=$1',
              [activity],
            )
          )[0].n,
          2,
        );
        assert.equal(
          (await api(operator, `/api/groups/${group}/history`)).total,
          3,
        );
        assert.ok(
          (await api(studentB, '/api/activities')).activities.some(
            (x) => x.id === activity,
          ),
        );
        assert.ok(
          !(await api(outsideStudent, '/api/activities')).activities.some(
            (x) => x.id === activity,
          ),
        );
        const assignment = (
          await sql(
            'select id from public.activity_assignments where activity_id=$1 and student_id=$2',
            [activity, studentA.id],
          )
        )[0].id;
        await api(
          studentA,
          `/api/activity-assignments/${assignment}/submit`,
          {},
        );
        assert.ok(
          (await api(studentA, '/api/activities')).activities
            .find((x) => x.id === activity)
            .assignments.some((x) => x.completion?.state === 'reported'),
        );
      },
    );
    await check(
      'inactive current group member remains removable without changing published assignments',
      async () => {
        await api(operator, `/api/groups/${group}/members`, {
          studentId: studentB.id,
          add: true,
        });
        await sql(
          'update public.department_student_roster set active=false where linked_student_id=$1',
          [studentB.id],
        );
        const current = await api(
          operator,
          `/api/groups/${group}/current-members`,
        );
        assert.equal(current.total, 2);
        assert.equal(
          current.members.find((x) => x.studentId === studentB.id).eligible,
          false,
        );
        await api(
          noGrant,
          `/api/groups/${group}/current-members`,
          undefined,
          403,
        );
        await api(
          operator,
          `/api/groups/${group}/activities`,
          {
            category: 'general',
            title: 'Must reject inactive member',
            description: '',
            startsAt: new Date(Date.now() - 60000).toISOString(),
            deadlineAt: new Date(Date.now() + 3600000).toISOString(),
            endsAt: new Date(Date.now() + 7200000).toISOString(),
            requiresVerification: false,
          },
          403,
        );
        await api(operator, `/api/groups/${group}/members`, {
          studentId: studentB.id,
          add: false,
        });
        await sql(
          'update public.department_student_roster set active=true where linked_student_id=$1',
          [studentB.id],
        );
        assert.equal(
          (
            await sql(
              'select count(*)::integer n from public.activity_assignments where activity_id=$1',
              [activity],
            )
          )[0].n,
          2,
        );
      },
    );
    await check(
      'group announcement uses current members and edit preserves publication snapshot',
      async () => {
        announcement = (
          await api(
            operator,
            `/api/groups/${group}/announcements`,
            { title: `Group notice ${tag}`, message: 'Synthetic notice' },
            201,
          )
        ).id;
        assert.equal(
          (
            await sql(
              'select count(*)::integer n from public.announcement_recipients where announcement_id=$1',
              [announcement],
            )
          )[0].n,
          1,
        );
        assert.equal(
          (
            await sql(
              'select member_count from public.activity_target_groups where activity_id=$1',
              [activity],
            )
          )[0].member_count,
          2,
        );
        await api(operator, `/api/groups/${group}`, {
          name: `RHP updated ${tag}`,
          type: 'Placement',
          active: true,
        });
        assert.equal(
          (
            await sql(
              'select count(*)::integer n from public.academic_group_changes where group_id=$1',
              [group],
            )
          )[0].n,
          1,
        );
      },
    );
    await check(
      'archived group rejects additions but permits authorized removal and later reactivation',
      async () => {
        await api(operator, `/api/groups/${group}`, {
          name: `RHP updated ${tag}`,
          type: 'Placement',
          active: false,
        });
        await api(
          operator,
          `/api/groups/${group}/members`,
          { studentId: studentB.id, add: true },
          400,
        );
        await api(operator, `/api/groups/${group}/members`, {
          studentId: studentA.id,
          add: false,
        });
        assert.equal(
          (await api(operator, `/api/groups/${group}/current-members`)).total,
          0,
        );
        await api(operator, `/api/groups/${group}`, {
          name: `RHP updated ${tag}`,
          type: 'Placement',
          active: true,
        });
        await api(operator, `/api/groups/${group}/members`, {
          studentId: studentA.id,
          add: true,
        });
        assert.equal(
          (
            await sql(
              'select count(*)::integer n from public.activity_assignments where activity_id=$1',
              [activity],
            )
          )[0].n,
          2,
        );
      },
    );
    await check(
      'five configurable test windows reject overlap and unauthorized calendar writes',
      async () => {
        schedule = (
          await api(
            operator,
            '/api/calendar/schedules',
            {
              departmentId: ids.department,
              name: `Weekly tests ${tag}`,
              description: 'Synthetic recurring external tests',
              timezone: 'Asia/Kolkata',
              anchorMonday: monday,
              cycleWeeks: 2,
              sectionIds: [ids.sectionA, ids.sectionB],
            },
            201,
          )
        ).id;
        assert.ok(schedule);
        await api(
          noGrant,
          '/api/calendar/sections?department=' + ids.department,
          undefined,
          403,
        );
        for (const [position, weekOffset, startDay, endDay] of slots)
          await api(operator, `/api/calendar/schedules/${schedule}/slots`, {
            position,
            weekOffset,
            startDay,
            endDay,
            startTime: '09:00',
            endTime: '18:00',
            title: `Test ${position} ${tag}`,
            description: 'External test availability window',
            requiresVerification: false,
            active: true,
          });
        await api(
          operator,
          `/api/calendar/schedules/${schedule}/slots`,
          {
            position: 6,
            weekOffset: 0,
            startDay: 1,
            endDay: 3,
            startTime: '10:00',
            endTime: '17:00',
            title: 'Overlapping',
            description: '',
            requiresVerification: false,
            active: true,
          },
          400,
        );
        assert.equal(
          (await api(operator, `/api/calendar/schedules/${schedule}/run`, {}))
            .paused,
          true,
        );
        await api(
          noGrant,
          `/api/calendar/schedules/${schedule}/pause`,
          { paused: false },
          403,
        );
        await api(operator, `/api/calendar/schedules/${schedule}/pause`, {
          paused: false,
        });
      },
    );
    await check(
      'blackout blocks only due instance, repeated runner stays idempotent, no blocked notices',
      async () => {
        blackout = (
          await api(
            operator,
            '/api/calendar/blackouts',
            {
              departmentId: ids.department,
              reason: 'Synthetic internal exam',
              startsAt: kolkata(day(monday, 3), '00:00'),
              endsAt: kolkata(day(monday, 5), '23:59'),
            },
            201,
          )
        ).id;
        const first = await api(
          operator,
          `/api/calendar/schedules/${schedule}/run`,
          { through: day(monday, 12) },
        );
        assert.equal(first.published, 4);
        assert.equal(first.blocked, 1);
        const second = await api(
          operator,
          `/api/calendar/schedules/${schedule}/run`,
          { through: day(monday, 12) },
        );
        assert.equal(second.published, 0);
        assert.equal(second.blocked, 0);
        const rows = await sql(
          'select id,status,activity_id from public.recurring_instances where schedule_id=$1',
          [schedule],
        );
        assert.equal(rows.length, 5);
        assert.equal(rows.filter((x) => x.status === 'blocked').length, 1);
        assert.equal(rows.filter((x) => x.status === 'published').length, 4);
        assert.equal(
          rows.find((x) => x.status === 'blocked').activity_id,
          null,
        );
        const blocked = rows.find((x) => x.status === 'blocked').id;
        await api(
          operator,
          `/api/calendar/conflicts/${blocked}/decision`,
          { decision: 'requeue' },
          400,
        );
        const blockedOutbox = await sql(
          `select count(*)::integer n from public.notification_outbox o
        join public.notifications n on n.id=o.notification_id
        where n.recipient_id=any($1::uuid[]) and n.title=$2`,
          [[studentA.id, studentB.id], `Test 2 ${tag}`],
        );
        assert.equal(blockedOutbox[0].n, 0);
        const overview = await api(
          operator,
          `/api/calendar?department=${ids.department}`,
        );
        assert.ok(overview.conflicts.some((x) => x.id === blocked));
        assert.equal(
          (await api(operator, `/api/calendar/schedules/${schedule}/instances`))
            .total,
          5,
        );
        await api(
          noGrant,
          `/api/calendar/schedules/${schedule}/instances`,
          undefined,
          403,
        );
        await api(operator, `/api/calendar/blackouts/${blackout}/active`, {
          active: false,
        });
        await api(operator, `/api/calendar/conflicts/${blocked}/decision`, {
          decision: 'requeue',
        });
        assert.equal(
          (
            await api(operator, `/api/calendar/schedules/${schedule}/run`, {
              through: day(monday, 12),
            })
          ).published,
          1,
        );
        assert.equal(
          (
            await sql(
              'select count(*)::integer n from public.recurring_instances where schedule_id=$1',
              [schedule],
            )
          )[0].n,
          5,
        );
      },
    );
    await check(
      'published blackout conflicts are visible; deadline changes are audited and scoped',
      async () => {
        await api(
          operator,
          '/api/calendar/blackouts',
          {
            departmentId: ids.department,
            reason: 'Published conflict check',
            startsAt: kolkata(monday, '00:00'),
            endsAt: kolkata(day(monday, 2), '23:59'),
          },
          201,
        );
        const overview = await api(
          operator,
          `/api/calendar?department=${ids.department}`,
        );
        assert.ok(
          overview.conflicts.some(
            (x) => x.publishedOverlap && x.status === 'published',
          ),
        );
        nptel = (
          await api(
            operator,
            '/api/activities/selected',
            {
              category: 'nptel',
              departmentScopeId: ids.department,
              studentIds: [studentA.id],
              counselingOnly: false,
              title: `NPTEL manual ${tag}`,
              description: 'Manual schedule',
              startsAt: new Date(Date.now() - 60000).toISOString(),
              deadlineAt: new Date(Date.now() + 3600000).toISOString(),
              endsAt: new Date(Date.now() + 7200000).toISOString(),
              requiresVerification: false,
            },
            201,
          )
        ).id;
        await api(
          noGrant,
          `/api/activities/${nptel}/window`,
          {
            deadlineAt: new Date(Date.now() + 10800000).toISOString(),
            endsAt: new Date(Date.now() + 14400000).toISOString(),
          },
          403,
        );
        await api(operator, `/api/activities/${nptel}/window`, {
          deadlineAt: new Date(Date.now() + 10800000).toISOString(),
          endsAt: new Date(Date.now() + 14400000).toISOString(),
        });
        assert.equal(
          (
            await sql(
              'select count(*)::integer n from public.activity_window_changes where activity_id=$1 and actor_id=$2',
              [nptel, operator.id],
            )
          )[0].n,
          1,
        );
      },
    );
    await check(
      'selected Activity counselor totals, unmapped work, pagination and permissions',
      async () => {
        const counselor = (
          await sql(
            "insert into public.responsibility_assignments(user_id,role,scope_id,starts_at) values($1,'counselor',$2,now()-interval '1 day') returning id",
            [operator.id, ids.department],
          )
        )[0].id;
        await sql(
          `insert into public.counselor_student_mappings(roster_student_id,counselor_responsibility_id,created_by,starts_at)
        select id,$1,$2,now()-interval '1 hour' from public.department_student_roster where linked_student_id=$3`,
          [counselor, operator.id, studentA.id],
        );
        const selected = (
          await sql(
            `insert into public.activities(category_key,scope_id,title,starts_at,deadline_at,ends_at,requires_verification,created_by)
        values('nptel',$1,'Selected Activity verification',now()-interval '1 hour',now()+interval '1 day',now()+interval '2 days',true,$2) returning id`,
            [ids.department, operator.id],
          )
        )[0].id;
        const assignments = await sql(
          'insert into public.activity_assignments(activity_id,student_id,assigned_by) values($1,$2,$4),($1,$3,$4) returning id,student_id',
          [selected, studentA.id, studentB.id, operator.id],
        );
        noDatabaseError(
          await studentA.client.rpc('submit_activity', {
            p_assignment: assignments.find((x) => x.student_id === studentA.id)
              .id,
          }),
          'real selected Activity submission',
        );
        const endpoint = `/api/supervision/activities?department=${ids.department}&activity=${selected}`;
        const result = await api(operator, endpoint);
        assert.equal(result.summary.assigned, 2);
        assert.equal(result.summary.reported, 1);
        assert.equal(result.summary.awaitingVerification, 1);
        assert.equal(result.summary.verified, 0);
        assert.equal(result.summary.pending, 1);
        assert.equal(result.summary.reportedPercent, 50);
        assert.equal(
          result.counselors.find((x) => x.counselorId === operator.id).reported,
          1,
        );
        assert.equal(
          result.counselors.find((x) => x.counselorId === null).pending,
          1,
        );
        assert.equal(
          result.counselors.reduce((n, x) => n + x.assigned, 0),
          2,
        );
        const laterPage = await api(operator, endpoint + '&offset=50');
        assert.deepEqual(laterPage.summary, result.summary);
        assert.deepEqual(laterPage.counselors, result.counselors);
        assert.equal(laterPage.students.length, 0);
        assert.equal(
          (await api(operator, endpoint + `&section=${ids.sectionB}`)).summary
            .reported,
          0,
        );
        const different = await api(
          operator,
          `/api/supervision/activities?department=${ids.department}&activity=${nptel}`,
        );
        assert.equal(different.summary.reported, 0);
        for (const person of [noGrant, studentA])
          await api(person, endpoint, undefined, 403);
        await api(
          operator,
          endpoint + `&section=${ids.outsideSection}`,
          undefined,
          403,
        );
        await api(
          operator,
          `/api/supervision/activities?department=${ids.outside}`,
          undefined,
          403,
        );
        await api(operator, endpoint + '&activity=bad', undefined, 400);
        // A verified completion remains reported but is no longer awaiting verification.
        await sql(
          "update public.activity_completions set state='verified',verified_by=$1,verified_at=now() where assignment_id=$2",
          [
            operator.id,
            assignments.find((x) => x.student_id === studentA.id).id,
          ],
        );
        const verified = await api(operator, endpoint);
        assert.equal(verified.summary.reported, 1);
        assert.equal(verified.summary.awaitingVerification, 0);
        assert.equal(verified.summary.verified, 1);
        // Current membership, not an old assignment or mapping, controls visibility.
        await sql(
          'update public.student_scope_memberships set ends_at=now() where student_id=$1 and scope_id=$2',
          [studentA.id, ids.sectionA],
        );
        assert.equal((await api(operator, endpoint)).summary.assigned, 1);
        await sql(
          'update public.student_scope_memberships set ends_at=null where student_id=$1 and scope_id=$2',
          [studentA.id, ids.sectionA],
        );
        await sql(
          'update public.department_student_roster set active=false where linked_student_id=$1',
          [studentB.id],
        );
        assert.equal((await api(operator, endpoint)).summary.assigned, 1);
        await sql(
          'update public.department_student_roster set active=true where linked_student_id=$1',
          [studentB.id],
        );
        const secondCounselor = (
          await sql(
            "insert into public.responsibility_assignments(user_id,role,scope_id,starts_at) values($1,'counselor',$2,now()-interval '1 day') returning id",
            [noGrant.id, ids.department],
          )
        )[0].id;
        await sql(
          `insert into public.counselor_student_mappings(roster_student_id,counselor_responsibility_id,created_by)
          select id,$1,$2 from public.department_student_roster where linked_student_id=$3`,
          [secondCounselor, operator.id, studentB.id],
        );
        const twoCounselors = await api(operator, endpoint);
        assert.equal(twoCounselors.counselors.length, 2);
        assert.equal(
          twoCounselors.counselors.find((row) => row.counselorId === noGrant.id)
            .pending,
          1,
        );
        // Close the previous allocation before assigning the same student to the next counselor.
        await sql(
          'update public.counselor_student_mappings set ends_at=now() where counselor_responsibility_id=$1',
          [counselor],
        );
        await sql(
          `insert into public.counselor_student_mappings(roster_student_id,counselor_responsibility_id,created_by)
          select id,$1,$2 from public.department_student_roster where linked_student_id=$3`,
          [secondCounselor, operator.id, studentA.id],
        );
        const reassigned = await api(operator, endpoint);
        assert.equal(reassigned.counselors.length, 1);
        assert.equal(reassigned.counselors[0].counselorId, noGrant.id);
        assert.equal(reassigned.counselors[0].assigned, 2);
        await sql(
          'update public.counselor_student_mappings set ends_at=now() where counselor_responsibility_id=$1',
          [secondCounselor],
        );
        const revoked = await api(operator, endpoint);
        assert.equal(revoked.counselors.length, 1);
        assert.equal(revoked.counselors[0].counselorId, null);
        assert.equal(revoked.counselors[0].assigned, 2);
      },
    );
    await check(
      'supervisor sees only explicit department scope with real drill-down',
      async () => {
        const overview = await api(
          operator,
          `/api/supervision?department=${ids.department}`,
        );
        assert.equal(overview.summary.activeStudents, 2);
        assert.ok(overview.summary.assignments >= 2);
        assert.equal(overview.students.length, 2);
        const inDepartmentDetail = await api(
          operator,
          `/api/supervision/students/${studentA.id}?department=${ids.department}`,
        );
        assert.ok(inDepartmentDetail.total >= 1);
        assert.ok(
          inDepartmentDetail.assignments.some(
            (row) => row.activityId === activity,
          ),
        );
        const foreignTitle = `Former department work ${tag}`;
        const foreignActivity = (
          await sql(
            `insert into public.activities(category_key,scope_id,title,description,starts_at,deadline_at,ends_at,requires_verification,created_by)
             values('general',$1,$2,'Synthetic historical transfer record',now()-interval '1 hour',now()+interval '1 hour',now()+interval '2 hours',false,$3) returning id`,
            [ids.outsideSection, foreignTitle, operator.id],
          )
        )[0].id;
        await sql(
          'insert into public.activity_assignments(activity_id,student_id,assigned_by) values($1,$2,$3)',
          [foreignActivity, studentA.id, operator.id],
        );
        const afterForeign = await api(
          operator,
          `/api/supervision?department=${ids.department}`,
        );
        assert.deepEqual(afterForeign.summary, overview.summary);
        assert.deepEqual(afterForeign.sections, overview.sections);
        assert.deepEqual(afterForeign.students, overview.students);
        await api(
          operator,
          `/api/supervision/activities?department=${ids.department}&activity=${foreignActivity}`,
          undefined,
          403,
        );
        const activityOptions = await api(
          operator,
          `/api/supervision/activities?department=${ids.department}`,
        );
        assert.ok(
          !activityOptions.activities.some((row) => row.id === foreignActivity),
        );
        const afterForeignDetail = await api(
          operator,
          `/api/supervision/students/${studentA.id}?department=${ids.department}`,
        );
        assert.equal(afterForeignDetail.total, inDepartmentDetail.total);
        assert.ok(
          !afterForeignDetail.assignments.some(
            (row) => row.activityId === foreignActivity,
          ),
        );
        assert.equal(
          (
            await api(
              operator,
              `/api/supervision?department=${ids.department}&section=${ids.sectionA}`,
            )
          ).summary.activeStudents,
          1,
        );
        await api(
          operator,
          `/api/supervision?department=${ids.outside}`,
          undefined,
          403,
        );
        await api(
          operator,
          `/api/supervision/students/${outsideStudent.id}?department=${ids.department}`,
          undefined,
          403,
        );
        await api(
          operator,
          `/api/supervision/students/${studentA.id}?department=${ids.outside}`,
          undefined,
          403,
        );
        await api(
          noGrant,
          `/api/supervision/students/${studentA.id}?department=${ids.department}`,
          undefined,
          403,
        );
        await api(
          operator,
          `/api/supervision?department=${ids.department}&section=${ids.outsideSection}`,
          undefined,
          403,
        );
        await api(
          noGrant,
          `/api/supervision?department=${ids.department}`,
          undefined,
          403,
        );
        await api(
          studentA,
          `/api/supervision?department=${ids.department}`,
          undefined,
          403,
        );
      },
    );
    await check(
      'trusted admin preview, grant and revocation audit operation capabilities',
      async () => {
        await sql(
          "insert into public.responsibility_assignments(user_id,role,scope_id,starts_at) values($1,'admin',$2,now()-interval '1 day')",
          [operator.id, ids.department],
        );
        async function grant(value, apply) {
          const args = [
            'scripts/directory-admin.mjs',
            'grant-operations',
            '--operator',
            operator.id,
            '--department',
            ids.department,
            '--responsibility',
            noResp,
            '--groups',
            value,
            '--calendar',
            'false',
            '--supervise',
            'false',
          ];
          if (apply) args.push('--apply');
          const result = await execute(process.execPath, args, {
            env: { ...process.env, LOCAL_DATABASE_URL: config.databaseUrl },
            timeout: 30000,
            maxBuffer: 1024 * 1024,
            windowsHide: true,
          });
          return result.stdout;
        }
        assert.match(await grant('true', false), /PREVIEW ONLY/);
        assert.equal(
          (await api(noGrant, '/api/department-operations')).departments.length,
          0,
        );
        assert.match(await grant('true', true), /COMMITTED/);
        assert.equal(
          (await api(noGrant, '/api/department-operations')).departments[0]
            .manageGroups,
          true,
        );
        await api(
          noGrant,
          `/api/groups/${group}/activities`,
          {
            category: 'weekly_test',
            title: 'Unauthorized category',
            description: '',
            startsAt: new Date(Date.now() - 60000).toISOString(),
            deadlineAt: new Date(Date.now() + 3600000).toISOString(),
            endsAt: new Date(Date.now() + 7200000).toISOString(),
            requiresVerification: false,
          },
          403,
        );
        assert.match(await grant('false', true), /COMMITTED/);
        await api(
          noGrant,
          `/api/groups?department=${ids.department}`,
          undefined,
          403,
        );
        assert.equal(
          (
            await sql(
              'select count(*)::integer n from public.department_operation_grant_history where responsibility_id=$1 and actor_id=$2',
              [noResp, operator.id],
            )
          )[0].n,
          2,
        );
      },
    );
    await check(
      'trusted local scheduler signs in and replays without duplicate Activities',
      async () => {
        const result = await execute(
          process.execPath,
          ['scripts/run-recurring-local.mjs'],
          {
            env: {
              ...process.env,
              APP_ENV: 'local',
              ARKST_SCHEDULER_EMAIL: operator.email,
              ARKST_SCHEDULER_PASSWORD: operator.password,
            },
            timeout: 45000,
            maxBuffer: 1024 * 1024,
            windowsHide: true,
          },
        );
        assert.match(
          result.stdout,
          /Real local recurring runner: 1 active schedules; 0 published/,
        );
        assert.equal(
          (
            await sql(
              'select count(*)::integer n from public.recurring_instances where schedule_id=$1',
              [schedule],
            )
          )[0].n,
          5,
        );
      },
    );
    await check(
      'Edge edits a persisted group, pauses/resumes calendar and filters supervision',
      async () => {
        const browser = await chromium.launch({
          channel: 'msedge',
          headless: true,
        });
        try {
          const page = await browser.newPage();
          await page.goto(`${config.appOrigin}/login`);
          await page.getByLabel('Email').fill(operator.email);
          await page.getByLabel('Password').fill(operator.password);
          await page
            .getByRole('button', { name: 'Sign in to local Supabase' })
            .click();
          await expect(page).toHaveURL(`${config.appOrigin}/profile`);
          await page.goto(`${config.appOrigin}/dashboard/groups`);
          await expect(
            page.getByRole('combobox', { name: 'Group' }),
          ).toContainText(`RHP updated ${tag}`);
          await page.getByLabel('Purpose', { exact: true }).fill('Hackathon');
          await page
            .getByRole('button', { name: 'Save group details' })
            .click();
          await expect(page.getByRole('status')).toContainText(
            'Group details updated.',
          );
          assert.equal(
            (await api(operator, `/api/groups?department=${ids.department}`))
              .groups[0].type,
            'Hackathon',
          );
          await page.goto(`${config.appOrigin}/dashboard/calendar`);
          await expect(
            page.getByRole('combobox', { name: 'Selected schedule' }),
          ).toContainText(`Weekly tests ${tag}`);
          await page
            .getByRole('button', { name: 'Pause', exact: true })
            .click();
          await expect(page.getByRole('status')).toContainText(
            'Schedule paused.',
          );
          await page
            .getByRole('button', { name: 'Resume', exact: true })
            .click();
          await expect(page.getByRole('status')).toContainText(
            'Schedule resumed.',
          );
          await page.goto(`${config.appOrigin}/dashboard/supervision`);
          await expect(
            page.getByRole('heading', { name: 'Supervisory overview' }),
          ).toBeVisible();
          await expect(page.getByText('Student A-17')).toBeVisible();
          await page
            .getByRole('combobox', { name: 'Activity', exact: true })
            .selectOption({ label: 'Selected Activity verification' });
          await expect(
            page.getByRole('cell', { name: '50%', exact: true }),
          ).toHaveCount(2);
          await expect(
            page.getByRole('rowheader', {
              name: 'Department total',
              exact: true,
            }),
          ).toBeVisible();
          await page
            .getByRole('combobox', { name: 'Section' })
            .selectOption(ids.sectionA);
          await expect(
            page.getByText('1 active students in this scope'),
          ).toBeVisible();
          await page.getByRole('button', { name: 'View work' }).click();
          await expect(
            page.getByRole('heading', {
              name: /Student A-17: Activity and case detail/,
            }),
          ).toBeVisible();
          await expect(
            page.getByText(`Former department work ${tag}`),
          ).toHaveCount(0);
        } finally {
          await browser.close();
        }
      },
    );
  } catch (error) {
    failures.push(error);
  } finally {
    if (connected) {
      try {
        const users = people.map((p) => p.id);
        await sql(
          'delete from public.notification_outbox where notification_id in (select id from public.notifications where recipient_id=any($1::uuid[]))',
          [users],
        );
        await sql(
          'delete from public.notifications where recipient_id=any($1::uuid[])',
          [users],
        );
        await sql(
          'delete from public.announcement_target_groups where announcement_id in (select id from public.announcements where created_by=any($1::uuid[]))',
          [users],
        );
        await sql(
          'delete from public.announcement_recipients where announcement_id in (select id from public.announcements where created_by=any($1::uuid[]))',
          [users],
        );
        await sql(
          'delete from public.announcement_target_sections where announcement_id in (select id from public.announcements where created_by=any($1::uuid[]))',
          [users],
        );
        await sql(
          'delete from public.announcements where created_by=any($1::uuid[])',
          [users],
        );
        await sql(
          'delete from public.activity_window_changes where activity_id in (select id from public.activities where created_by=any($1::uuid[]))',
          [users],
        );
        await sql(
          'delete from public.recurring_instances where schedule_id in (select id from public.recurring_schedules where department_scope_id=$1)',
          [ids.department],
        );
        await sql(
          'delete from public.activity_target_groups where activity_id in (select id from public.activities where created_by=any($1::uuid[]))',
          [users],
        );
        await sql(
          'delete from public.activity_completions where assignment_id in (select x.id from public.activity_assignments x join public.activities a on a.id=x.activity_id where a.created_by=any($1::uuid[]))',
          [users],
        );
        await sql(
          'delete from public.activity_history where activity_id in (select id from public.activities where created_by=any($1::uuid[]))',
          [users],
        );
        await sql(
          'delete from public.activity_target_sections where activity_id in (select id from public.activities where created_by=any($1::uuid[]))',
          [users],
        );
        await sql(
          'delete from public.activity_assignments where activity_id in (select id from public.activities where created_by=any($1::uuid[]))',
          [users],
        );
        await sql(
          'delete from public.activities where created_by=any($1::uuid[])',
          [users],
        );
        await sql(
          'delete from public.academic_blackouts where department_scope_id=$1',
          [ids.department],
        );
        await sql(
          'delete from public.recurring_schedule_slots where schedule_id in (select id from public.recurring_schedules where department_scope_id=$1)',
          [ids.department],
        );
        await sql(
          'delete from public.recurring_schedule_sections where schedule_id in (select id from public.recurring_schedules where department_scope_id=$1)',
          [ids.department],
        );
        await sql(
          'delete from public.recurring_schedules where department_scope_id=$1',
          [ids.department],
        );
        await sql(
          'delete from public.academic_group_changes where group_id in (select scope_id from public.academic_groups where department_scope_id=$1)',
          [ids.department],
        );
        await sql(
          'delete from public.group_membership_history where group_id in (select scope_id from public.academic_groups where department_scope_id=$1)',
          [ids.department],
        );
        await sql(
          'delete from public.student_scope_memberships where scope_id in (select scope_id from public.academic_groups where department_scope_id=$1)',
          [ids.department],
        );
        await sql(
          'delete from public.academic_groups where department_scope_id=$1',
          [ids.department],
        );
        await sql(
          "delete from public.scopes where kind='group' and parent_id=$1",
          [ids.department],
        );
        await sql(
          'delete from public.counselor_student_mappings where roster_student_id in (select id from public.department_student_roster where department_scope_id=any($1::uuid[]))',
          [[ids.department, ids.outside]],
        );
        await sql(
          'delete from public.department_student_roster where department_scope_id=any($1::uuid[])',
          [[ids.department, ids.outside]],
        );
        await sql(
          'delete from public.student_scope_memberships where scope_id=any($1::uuid[])',
          [[ids.sectionA, ids.sectionB, ids.outsideSection]],
        );
        await sql(
          'delete from public.department_operation_grant_history where responsibility_id in (select id from public.responsibility_assignments where user_id=any($1::uuid[]))',
          [users],
        );
        await sql(
          'delete from public.department_operation_capabilities where responsibility_id in (select id from public.responsibility_assignments where user_id=any($1::uuid[]))',
          [users],
        );
        await sql(
          'delete from public.activity_capabilities where responsibility_id in (select id from public.responsibility_assignments where user_id=any($1::uuid[]))',
          [users],
        );
        await sql(
          'delete from public.responsibility_assignments where user_id=any($1::uuid[])',
          [users],
        );
        await sql('delete from public.scopes where id=any($1::uuid[])', [
          [
            ids.sectionA,
            ids.sectionB,
            ids.outsideSection,
            ids.department,
            ids.outside,
          ],
        ]);
      } catch (error) {
        failures.push(new Error(`Synthetic cleanup failed: ${error.message}`));
      }
    }
    for (const p of people.toReversed()) {
      try {
        noDatabaseError(
          await admin.auth.admin.deleteUser(p.id),
          'remove synthetic Auth user',
        );
      } catch (error) {
        failures.push(
          new Error(`Synthetic Auth cleanup failed: ${error.message}`),
        );
      }
    }
    if (connected) await db.end();
  }
  if (failures.length) {
    for (const failure of failures)
      console.error(failure.stack ?? failure.message);
    process.exitCode = 1;
  } else
    console.log(
      `PASS: ${passed} real Session 2 integration and browser groups; synthetic fixtures removed.`,
    );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
