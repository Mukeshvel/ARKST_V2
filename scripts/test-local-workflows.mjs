import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { chromium, expect } from '@playwright/test';
import {
  AppBrowser,
  localFetch,
  localTestConfiguration,
  noDatabaseError,
} from '../tests/integration/local-helpers.mjs';

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
    query_timeout: 15000,
  });
  const ids = {
    department: randomUUID(),
    sectionA: randomUUID(),
    sectionB: randomUUID(),
    outside: randomUUID(),
    outsideSection: randomUUID(),
  };
  const users = [];
  const cleanupErrors = [];
  let connected = false;
  let passed = 0;
  let failure;
  async function check(label, fn) {
    await fn();
    console.log(`PASS ${++passed}: ${label}`);
  }
  async function user(label, kind = 'student') {
    const entry = {
      email: `arkst-workflow-${tag}-${label}@example.test`,
      password: `T!${randomBytes(24).toString('base64url')}`,
    };
    entry.id = noDatabaseError(
      await admin.auth.admin.createUser({ ...entry, email_confirm: true }),
      'create synthetic Auth account',
    ).user.id;
    users.push(entry);
    noDatabaseError(
      await admin.from('profiles').insert({
        id: entry.id,
        display_name: `Workflow ${label}`,
        account_kind: kind,
        staff_classification: kind === 'staff' ? 'teaching' : null,
        is_active: true,
      }),
      'provision profile',
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
      'real sign-in',
    );
    entry.browser = new AppBrowser(config.appOrigin);
    await entry.browser.login(entry);
    return entry;
  }
  async function bareStudent(label) {
    const entry = {
      email: `arkst-workflow-${tag}-${label}@example.test`,
      password: `T!${randomBytes(24).toString('base64url')}`,
    };
    entry.id = noDatabaseError(
      await admin.auth.admin.createUser({ ...entry, email_confirm: true }),
      'create synthetic bulk Auth account',
    ).user.id;
    users.push(entry);
    noDatabaseError(
      await admin.from('profiles').insert({
        id: entry.id,
        display_name: `Workflow ${label}`,
        account_kind: 'student',
        is_active: true,
      }),
      'provision synthetic bulk student',
    );
    return entry;
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
  async function responsibility(person, role, scope) {
    return (
      await db.query(
        "insert into public.responsibility_assignments(user_id,role,scope_id,starts_at) values($1,$2,$3,now()-interval '1 day') returning id",
        [person.id, role, scope],
      )
    ).rows[0].id;
  }
  async function capability(resp, category) {
    await db.query(
      'insert into public.activity_capabilities(responsibility_id,category_key,can_create) values($1,$2,true)',
      [resp, category],
    );
  }
  async function roster(person, section, external, actor) {
    const id = (
      await db.query(
        'insert into public.department_student_roster(department_scope_id,section_scope_id,external_student_id,display_name,linked_student_id,created_by) values($1,$2,$3,$4,$5,$6) returning id',
        [
          ids.department,
          section,
          external,
          `Workflow ${external}`,
          person.id,
          actor.id,
        ],
      )
    ).rows[0].id;
    await db.query(
      'insert into public.student_scope_memberships(student_id,scope_id) values($1,$2)',
      [person.id, section],
    );
    return id;
  }
  const activityInput = (category, studentIds, title) => ({
    category,
    departmentScopeId: ids.department,
    studentIds,
    counselingOnly: false,
    title,
    description: 'External work tracked in ARKST.',
    startsAt: new Date(Date.now() - 60000).toISOString(),
    deadlineAt: new Date(Date.now() + 3600000).toISOString(),
    endsAt: new Date(Date.now() + 7200000).toISOString(),
    requiresVerification: false,
  });
  try {
    await db.connect();
    connected = true;
    await db.query(
      "insert into public.scopes(id,name,kind) values($1,$2,'department'),($3,$4,'department')",
      [ids.department, `Workflow ${tag}`, ids.outside, `Outside ${tag}`],
    );
    await db.query(
      "insert into public.scopes(id,name,kind,parent_id) values($1,'A','section',$4),($2,'B','section',$4),($3,'Outside','section',$5)",
      [
        ids.sectionA,
        ids.sectionB,
        ids.outsideSection,
        ids.department,
        ids.outside,
      ],
    );
    const teacher = await user('teacher', 'staff');
    const counselor = await user('counselor', 'staff');
    const otherCounselor = await user('other-counselor', 'staff');
    const coordinator = await user('coordinator', 'staff');
    const hod = await user('hod', 'staff');
    const branch = await user('branch', 'staff');
    const outsider = await user('outsider', 'staff');
    const s1 = await user('student-a');
    const s2 = await user('student-b');
    const s3 = await user('student-unmapped');
    const teacherResp = await responsibility(
      teacher,
      'teacher',
      ids.department,
    );
    await capability(teacherResp, 'nptel');
    await capability(teacherResp, 'general');
    const counselorResp = await responsibility(
      counselor,
      'counselor',
      ids.department,
    );
    const otherCounselorResp = await responsibility(
      otherCounselor,
      'counselor',
      ids.department,
    );
    const coordinatorResp = await responsibility(
      coordinator,
      'coordinator',
      ids.department,
    );
    const hodResp = await responsibility(hod, 'hod', ids.department);
    const branchResp = await responsibility(
      branch,
      'branch_coordinator',
      ids.department,
    );
    const outsiderResp = await responsibility(outsider, 'teacher', ids.outside);
    await capability(outsiderResp, 'general');
    const r1 = await roster(s1, ids.sectionA, `A-17-${tag}`, teacher);
    const r2 = await roster(s2, ids.sectionB, `B-92-${tag}`, teacher);
    await roster(s3, ids.sectionA, `A-1003-${tag}`, teacher);
    await db.query(
      'insert into public.counselor_student_mappings(roster_student_id,counselor_responsibility_id,created_by) values($1,$2,$3),($4,$5,$3)',
      [r1, counselorResp, teacher.id, r2, otherCounselorResp],
    );
    await db.query(
      "insert into public.escalation_routes(section_scope_id,target_role,responsibility_id) values($1,'coordinator',$2),($1,'hod',$3)",
      [ids.sectionA, coordinatorResp, hodResp],
    );
    await check(
      'NPTEL Activity is assigned to real local students',
      async () => {
        const made = await api(
          teacher,
          '/api/activities/selected',
          activityInput('nptel', [s1.id, s2.id], `NPTEL ${tag}`),
          201,
        );
        assert.equal(made.assignedCount, 2);
        ids.nptel = made.id;
        const rows = await db.query(
          'select id,student_id from public.activity_assignments where activity_id=$1',
          [ids.nptel],
        );
        ids.a1 = rows.rows.find((x) => x.student_id === s1.id).id;
        ids.a2 = rows.rows.find((x) => x.student_id === s2.id).id;
      },
    );
    await check(
      'counselor follow-up is scoped, atomic, visible to recipient, and duplicate blocked',
      async () => {
        const denied = await api(
          counselor,
          '/api/follow-ups',
          { assignmentIds: [ids.a2], reason: 'Outside mapping' },
          403,
        );
        assert.ok(denied.error);
        const outsiderDenied = await api(
          outsider,
          '/api/follow-ups',
          { assignmentIds: [ids.a1], reason: 'Outside department' },
          403,
        );
        assert.ok(outsiderDenied.error);
        const sent = await api(
          counselor,
          '/api/follow-ups',
          {
            assignmentIds: [ids.a1],
            reason: 'Please report the external work.',
          },
          201,
        );
        assert.equal(sent.count, 1);
        ids.followup = sent.ids[0];
        const notice = (await api(s1, `/api/notifications`)).notifications.find(
          (x) => x.source_id === ids.followup,
        );
        assert.ok(notice);
        assert.equal(
          (await api(s1, `/api/notifications/${notice.id}/push-preview`)).url,
          `/dashboard/student?activity=${ids.nptel}`,
        );
        assert.equal(
          (
            await api(
              s2,
              `/api/notifications/${notice.id}/push-preview`,
              undefined,
              404,
            )
          ).error.length > 0,
          true,
        );
        assert.equal(
          (await api(s2, `/api/follow-ups?assignment=${ids.a1}`)).total,
          0,
        );
        assert.equal(
          (await api(outsider, `/api/follow-ups?assignment=${ids.a1}`)).total,
          0,
        );
        assert.equal(
          (
            await api(
              counselor,
              '/api/follow-ups',
              { assignmentIds: [ids.a1], reason: 'Duplicate' },
              409,
            )
          ).error.length > 0,
          true,
        );
        const attention = await api(counselor, '/api/attention');
        assert.ok(
          attention.items.some(
            (x) =>
              x.assignmentId === ids.a1 &&
              x.reasons.includes('Unresolved follow-up'),
          ),
        );
        assert.ok(!attention.items.some((x) => x.assignmentId === ids.a2));
      },
    );
    await check(
      'student report resolves follow-up without losing history',
      async () => {
        await api(s1, `/api/activity-assignments/${ids.a1}/submit`, {}, 200);
        const row = (
          await db.query(
            'select status,resolution from public.activity_follow_ups where id=$1',
            [ids.followup],
          )
        ).rows[0];
        assert.deepEqual(row, {
          status: 'resolved',
          resolution: 'student_reported',
        });
        assert.equal(
          (
            await db.query(
              'select count(*)::int n from public.activity_follow_up_history where follow_up_id=$1',
              [ids.followup],
            )
          ).rows[0].n,
          2,
        );
        const monitor = await api(
          counselor,
          `/api/counselor/activities/${ids.nptel}`,
        );
        assert.equal(monitor.assignments[0].state, 'reported');
        assert.equal(
          (
            await api(
              counselor,
              '/api/follow-ups',
              { assignmentIds: [ids.a1], reason: 'After completion' },
              409,
            )
          ).error.length > 0,
          true,
        );
      },
    );
    await check(
      'catch-up request requires authorized review and separate publication',
      async () => {
        const request = await api(
          s1,
          '/api/catch-up',
          {
            subject: `Missed lecture ${tag}`,
            missedInformation: 'Training prevented attendance.',
          },
          201,
        );
        ids.catchup = request.id;
        const counselorMissed = await api(counselor, '/api/attention/missed');
        assert.ok(
          counselorMissed.requests.some(
            (row) => row.id === request.id && !row.canReview,
          ),
        );
        const creatorMissed = await api(teacher, '/api/attention/missed');
        assert.ok(
          creatorMissed.requests.some(
            (row) => row.id === request.id && row.canReview,
          ),
        );
        assert.equal(
          (await api(otherCounselor, '/api/attention/missed')).total,
          0,
        );
        assert.equal(
          (
            await api(
              s1,
              `/api/catch-up/${ids.catchup}/review`,
              { approve: true },
              403,
            )
          ).error.length > 0,
          true,
        );
        assert.equal(
          (
            await api(
              counselor,
              `/api/catch-up/${ids.catchup}/review`,
              { approve: true },
              403,
            )
          ).error.length > 0,
          true,
        );
        assert.equal(
          (
            await api(
              outsider,
              `/api/catch-up/${ids.catchup}/review`,
              { approve: true },
              403,
            )
          ).error.length > 0,
          true,
        );
        await api(teacher, `/api/catch-up/${ids.catchup}/review`, {
          approve: true,
        });
        const own = await api(s1, '/api/catch-up');
        assert.equal(
          own.requests.find((x) => x.id === ids.catchup).status,
          'approved',
        );
        const published = await api(
          teacher,
          `/api/catch-up/${ids.catchup}/publish`,
          {
            departmentScopeId: ids.department,
            mode: 'selected',
            studentIds: [s1.id, s2.id],
            title: `Official catch-up ${tag}`,
            message: 'Approved academic information.',
          },
        );
        assert.equal(published.recipientCount, 2);
        assert.ok(
          (await api(s2, '/api/notifications')).notifications.some(
            (x) => x.source_id === published.announcementId,
          ),
        );
        assert.equal(
          (await api(s2, `/api/announcements/${published.announcementId}`))
            .announcement.title,
          `Official catch-up ${tag}`,
        );
        assert.equal(
          (
            await api(
              s3,
              `/api/announcements/${published.announcementId}`,
              undefined,
              404,
            )
          ).error.length > 0,
          true,
        );
        assert.equal(
          (
            await api(
              teacher,
              `/api/catch-up/${ids.catchup}/publish`,
              {
                departmentScopeId: ids.department,
                mode: 'selected',
                studentIds: [s1.id],
                title: 'Again',
                message: 'Again',
              },
              409,
            )
          ).error.length > 0,
          true,
        );
        assert.equal(
          (
            await db.query(
              'select count(*)::int n from public.catch_up_history where request_id=$1',
              [ids.catchup],
            )
          ).rows[0].n,
          3,
        );
        const reject = await api(
          s2,
          '/api/catch-up',
          {
            subject: `Missed workshop ${tag}`,
            missedInformation: 'Competition travel.',
          },
          201,
        );
        assert.equal(
          (
            await api(
              teacher,
              `/api/catch-up/${reject.id}/review`,
              { approve: false },
              400,
            )
          ).error.length > 0,
          true,
        );
        await api(teacher, `/api/catch-up/${reject.id}/review`, {
          approve: false,
          reason: 'No approved information is available.',
        });
        assert.equal(
          (await api(s2, '/api/catch-up')).requests.find(
            (x) => x.id === reject.id,
          ).status,
          'rejected',
        );
      },
    );
    await check(
      'own creator can follow up without counselor mapping and close with history',
      async () => {
        const made = await api(
          teacher,
          '/api/activities/selected',
          activityInput('general', [s3.id], `Creator follow-up ${tag}`),
          201,
        );
        const assignment = (
          await db.query(
            'select id from public.activity_assignments where activity_id=$1',
            [made.id],
          )
        ).rows[0].id;
        assert.equal(
          (
            await api(
              s3,
              '/api/follow-ups',
              { assignmentIds: [assignment], reason: 'Unauthorized student' },
              403,
            )
          ).error.length > 0,
          true,
        );
        assert.equal(
          (
            await api(
              counselor,
              '/api/follow-ups',
              { assignmentIds: [assignment], reason: 'Not mapped' },
              403,
            )
          ).error.length > 0,
          true,
        );
        const sent = await api(
          teacher,
          '/api/follow-ups',
          {
            assignmentIds: [assignment],
            reason: 'Please check your assignment.',
          },
          201,
        );
        const id = sent.ids[0];
        assert.ok(
          (
            await api(teacher, `/api/follow-ups?assignment=${assignment}`)
          ).followUps.some((x) => x.id === id),
        );
        assert.equal(
          (
            await api(
              counselor,
              `/api/follow-ups/${id}/resolve`,
              { note: 'Not my case' },
              403,
            )
          ).error.length > 0,
          true,
        );
        await api(teacher, `/api/follow-ups/${id}/resolve`, {
          note: 'Explained in class.',
        });
        assert.equal(
          (
            await db.query(
              'select status,resolution from public.activity_follow_ups where id=$1',
              [id],
            )
          ).rows[0].resolution,
          'staff_closed',
        );
        assert.equal(
          (
            await api(
              teacher,
              '/api/follow-ups',
              { assignmentIds: [assignment], reason: 'Too soon' },
              409,
            )
          ).error.length > 0,
          true,
        );
        assert.equal(
          (
            await db.query(
              'select count(*)::int n from public.activity_completions where assignment_id=$1',
              [assignment],
            )
          ).rows[0].n,
          0,
        );
      },
    );
    await check(
      'student-to-counselor-to-coordinator-to-HOD escalation uses current routes',
      async () => {
        const made = await api(
          teacher,
          '/api/activities/selected',
          activityInput('general', [s1.id], `Escalation ${tag}`),
          201,
        );
        ids.escalationActivity = made.id;
        const assignment = (
          await db.query(
            'select id from public.activity_assignments where activity_id=$1',
            [made.id],
          )
        ).rows[0].id;
        ids.escalationAssignment = assignment;
        await assert.rejects(
          db.query(
            "insert into public.escalation_routes(section_scope_id,target_role,responsibility_id) values($1,'branch_coordinator',$2)",
            [ids.sectionA, outsiderResp],
          ),
          { code: '23514' },
        );
        assert.equal(
          (
            await api(
              counselor,
              '/api/follow-ups',
              {
                assignmentIds: [assignment, ids.a2],
                reason: 'Must be all or nothing',
              },
              403,
            )
          ).error.length > 0,
          true,
        );
        assert.equal(
          (
            await db.query(
              'select count(*)::int n from public.activity_follow_ups where assignment_id=$1',
              [assignment],
            )
          ).rows[0].n,
          0,
        );
        assert.equal(
          (
            await api(
              s2,
              '/api/escalations',
              { assignmentId: assignment, reason: 'Not mine' },
              403,
            )
          ).error.length > 0,
          true,
        );
        const first = await api(
          s1,
          '/api/escalations',
          { assignmentId: assignment, reason: 'I need help with this work.' },
          201,
        );
        assert.equal(first.stage, 'counselor');
        const escalationNotice = (
          await api(counselor, '/api/notifications')
        ).notifications.find((x) => x.source_id === first.id);
        assert.ok(escalationNotice);
        assert.equal(
          (
            await api(
              counselor,
              `/api/notifications/${escalationNotice.id}/push-preview`,
            )
          ).url,
          '/dashboard/attention',
        );
        assert.equal(
          (
            await api(
              s1,
              '/api/escalations',
              { assignmentId: assignment, reason: 'Duplicate' },
              409,
            )
          ).error.length > 0,
          true,
        );
        assert.equal(
          (
            await api(
              otherCounselor,
              '/api/escalations',
              { assignmentId: assignment, reason: 'Wrong mapping' },
              403,
            )
          ).error.length > 0,
          true,
        );
        const second = await api(
          counselor,
          '/api/escalations',
          { assignmentId: assignment, reason: 'Coordinator attention needed.' },
          201,
        );
        assert.equal(second.stage, 'coordinator');
        const third = await api(
          coordinator,
          '/api/escalations',
          { assignmentId: assignment, reason: 'HOD attention needed.' },
          201,
        );
        assert.equal(third.stage, 'hod');
        assert.equal(
          (
            await api(
              outsider,
              `/api/escalations/${third.id}/resolve`,
              { note: 'No authority' },
              403,
            )
          ).error.length > 0,
          true,
        );
        await api(hod, `/api/escalations/${third.id}/resolve`, {
          note: 'Reviewed and directed staff follow-up.',
        });
        assert.equal(
          (
            await db.query(
              'select status from public.activity_escalations where id=$1',
              [third.id],
            )
          ).rows[0].status,
          'resolved',
        );
        assert.ok(
          (await api(hod, '/api/escalations')).escalations.some(
            (x) => x.id === third.id,
          ),
        );
      },
    );
    await check(
      'configured branch coordinator receives the third stage when present',
      async () => {
        await db.query(
          "insert into public.escalation_routes(section_scope_id,target_role,responsibility_id) values($1,'branch_coordinator',$2)",
          [ids.sectionA, branchResp],
        );
        const made = await api(
          teacher,
          '/api/activities/selected',
          activityInput('general', [s1.id], `Branch route ${tag}`),
          201,
        );
        const assignment = (
          await db.query(
            'select id from public.activity_assignments where activity_id=$1',
            [made.id],
          )
        ).rows[0].id;
        await api(
          s1,
          '/api/escalations',
          { assignmentId: assignment, reason: 'Counselor help.' },
          201,
        );
        await api(
          counselor,
          '/api/escalations',
          { assignmentId: assignment, reason: 'Coordinator help.' },
          201,
        );
        const stage = await api(
          coordinator,
          '/api/escalations',
          { assignmentId: assignment, reason: 'Branch help.' },
          201,
        );
        assert.equal(stage.stage, 'branch_coordinator');
        assert.ok(
          (await api(branch, '/api/escalations')).escalations.some(
            (x) => x.id === stage.id && x.isRecipient,
          ),
        );
        await api(branch, `/api/escalations/${stage.id}/resolve`, {
          note: 'Reviewed by branch coordinator.',
        });
      },
    );
    await check(
      'empty results, duplicate catch-up, and unauthorized publication fail honestly',
      async () => {
        assert.equal((await api(outsider, '/api/attention')).total, 0);
        assert.equal((await api(s3, '/api/catch-up')).total, 0);
        const pending = await api(
          s3,
          '/api/catch-up',
          {
            subject: `Duplicate check ${tag}`,
            missedInformation: 'Same subject.',
          },
          201,
        );
        assert.ok(pending.id);
        assert.equal(
          (
            await api(
              s3,
              '/api/catch-up',
              {
                subject: `Duplicate check ${tag}`,
                missedInformation: 'Same subject again.',
              },
              409,
            )
          ).error.length > 0,
          true,
        );
        await api(
          s1,
          '/api/catch-up',
          {
            subject: `Missed instructions ${tag}`,
            missedInformation: 'Please clarify the course instructions.',
          },
          201,
        );
        const attention = await api(counselor, '/api/attention');
        assert.ok(
          attention.items.some(
            (x) =>
              x.assignmentId === ids.escalationAssignment &&
              x.reasons.includes('Missed academic information request'),
          ),
        );
        assert.equal(
          (await api(otherCounselor, '/api/attention')).items.some(
            (x) => x.assignmentId === ids.escalationAssignment,
          ),
          false,
        );
        assert.equal(
          (
            await api(
              s1,
              `/api/catch-up/${ids.catchup}/publish`,
              {
                departmentScopeId: ids.department,
                mode: 'selected',
                studentIds: [s1.id],
                title: 'Unauthorized',
                message: 'Unauthorized',
              },
              403,
            )
          ).error.length > 0,
          true,
        );
        assert.equal(
          (await api(s2, `/api/catch-up?offset=0`)).requests.some(
            (x) => x.id === ids.catchup,
          ),
          false,
        );
      },
    );
    await check(
      '55 real recipient assignments and follow-ups persist without truncation',
      async () => {
        const bulk = [];
        for (let i = 0; i < 55; i++) {
          const person = await bareStudent(`bulk-${i}`);
          const rosterId = await roster(
            person,
            ids.sectionA,
            `BULK-${i}-${tag}`,
            teacher,
          );
          await db.query(
            'insert into public.counselor_student_mappings(roster_student_id,counselor_responsibility_id,created_by) values($1,$2,$3)',
            [rosterId, counselorResp, teacher.id],
          );
          bulk.push(person.id);
        }
        const made = await api(
          teacher,
          '/api/activities/selected',
          activityInput('general', bulk, `Bulk follow-up ${tag}`),
          201,
        );
        assert.equal(made.assignedCount, 55);
        const assignments = (
          await db.query(
            'select id from public.activity_assignments where activity_id=$1 order by id',
            [made.id],
          )
        ).rows.map((x) => x.id);
        const sent = await api(
          counselor,
          '/api/follow-ups',
          { assignmentIds: assignments, reason: 'Check the external work.' },
          201,
        );
        assert.equal(sent.count, 55);
        assert.equal(
          (
            await db.query(
              'select count(*)::int n from public.activity_follow_ups where assignment_id=any($1::uuid[])',
              [assignments],
            )
          ).rows[0].n,
          55,
        );
        assert.equal(
          (
            await db.query(
              "select count(*)::int n from public.notifications where source_kind='follow_up' and recipient_id=any($1::uuid[])",
              [bulk],
            )
          ).rows[0].n,
          55,
        );
      },
    );
    await check(
      'outbox failure rolls back a follow-up and reports failure',
      async () => {
        const name = `test_workflow_fail_${tag}`;
        await db.query(
          `create function public.${name}() returns trigger language plpgsql as $$ begin if exists(select 1 from public.notifications where id=new.notification_id and source_kind='follow_up') then raise exception 'synthetic outbox failure'; end if; return new; end $$`,
        );
        await db.query(
          `create trigger ${name} before insert on public.notification_outbox for each row execute function public.${name}()`,
        );
        try {
          const response = await api(
            otherCounselor,
            '/api/follow-ups',
            { assignmentIds: [ids.a2], reason: 'Must rollback' },
            503,
          );
          assert.ok(response.error);
          assert.equal(
            (
              await db.query(
                'select count(*)::int n from public.activity_follow_ups where assignment_id=$1',
                [ids.a2],
              )
            ).rows[0].n,
            0,
          );
        } finally {
          await db.query(
            `drop trigger if exists ${name} on public.notification_outbox`,
          );
          await db.query(`drop function if exists public.${name}()`);
        }
      },
    );
    await check(
      'student completion resolves an open counselor escalation',
      async () => {
        const first = await api(
          s2,
          '/api/escalations',
          { assignmentId: ids.a2, reason: 'I need help.' },
          201,
        );
        assert.equal(first.stage, 'counselor');
        assert.equal(
          (
            await api(
              otherCounselor,
              '/api/escalations',
              { assignmentId: ids.a2, reason: 'No configured coordinator' },
              400,
            )
          ).error.length > 0,
          true,
        );
        await api(s2, `/api/activity-assignments/${ids.a2}/submit`, {});
        const resolved = (
          await db.query(
            'select status,resolution_note from public.activity_escalations where id=$1',
            [first.id],
          )
        ).rows[0];
        assert.equal(resolved.status, 'resolved');
        assert.equal(resolved.resolution_note, 'Student reported completion');
        assert.equal(
          (
            await db.query(
              'select count(*)::int n from public.activity_escalation_history where escalation_id=$1',
              [first.id],
            )
          ).rows[0].n,
          2,
        );
        const next = await api(
          teacher,
          '/api/activities/selected',
          activityInput('general', [s2.id], `Mapping expiry ${tag}`),
          201,
        );
        ids.expiryAssignment = (
          await db.query(
            'select id from public.activity_assignments where activity_id=$1',
            [next.id],
          )
        ).rows[0].id;
      },
    );
    await check(
      'Edge renders the real catch-up and attention dashboards',
      async () => {
        const browser = await chromium.launch({
          channel: 'msedge',
          headless: true,
        });
        try {
          const context = await browser.newContext();
          const page = await context.newPage();
          await page.goto(`${config.appOrigin}/login`);
          await page.getByLabel('Email').fill(teacher.email);
          await page.getByLabel('Password').fill(teacher.password);
          await page
            .getByRole('button', { name: 'Sign in to local Supabase' })
            .click();
          await expect(page).toHaveURL(`${config.appOrigin}/profile`);
          await page.goto(`${config.appOrigin}/dashboard/catch-up`);
          await expect(page.getByText(`Missed lecture ${tag}`)).toBeVisible();
          const pending = page
            .locator('.dashboard-card')
            .filter({ hasText: `Missed instructions ${tag}` });
          await pending
            .getByRole('button', { name: 'Approve for publication' })
            .click();
          await expect(
            pending
              .locator('.dashboard-eyebrow')
              .filter({ hasText: 'approved' }),
          ).toBeVisible();
          await pending
            .getByLabel('Official title')
            .fill(`Browser catch-up ${tag}`);
          await pending
            .getByLabel('Official information')
            .fill('Staff confirmed the missed instructions.');
          await pending
            .getByRole('button', { name: 'Publish official announcement' })
            .click();
          await expect(
            pending.getByRole('link', { name: 'Open published announcement' }),
          ).toBeVisible();
          assert.ok(
            (await api(s1, '/api/notifications')).notifications.some(
              (x) => x.title === `Browser catch-up ${tag}`,
            ),
          );
          await page.goto(`${config.appOrigin}/dashboard/attention`);
          await expect(
            page.getByRole('heading', { name: 'Attention needed' }),
          ).toBeVisible();
          await expect(
            page.getByRole('heading', { name: 'Missed academic information' }),
          ).toBeVisible();
          const counselorContext = await browser.newContext();
          const counselorPage = await counselorContext.newPage();
          await counselorPage.goto(`${config.appOrigin}/login`);
          await counselorPage.getByLabel('Email').fill(counselor.email);
          await counselorPage.getByLabel('Password').fill(counselor.password);
          await counselorPage
            .getByRole('button', { name: 'Sign in to local Supabase' })
            .click();
          await expect(counselorPage).toHaveURL(`${config.appOrigin}/profile`);
          await counselorPage.goto(
            `${config.appOrigin}/dashboard/counselor/activities/${ids.nptel}`,
          );
          await expect(
            counselorPage.getByRole('heading', { name: 'Recorded follow-ups' }),
          ).toBeVisible();
          await expect(
            counselorPage.getByText('Student reported completion'),
          ).toBeVisible();
          await counselorContext.close();
          await context.close();
        } finally {
          await browser.close();
        }
      },
    );
    await check(
      'expired mapping and inactive roster remove current scoped access but retain history',
      async () => {
        assert.ok(
          (await api(otherCounselor, '/api/attention')).items.some(
            (x) => x.assignmentId === ids.expiryAssignment,
          ),
        );
        await db.query(
          'update public.counselor_student_mappings set ends_at=now() where roster_student_id=$1',
          [r2],
        );
        assert.equal(
          (await api(otherCounselor, '/api/attention')).items.some(
            (x) => x.assignmentId === ids.expiryAssignment,
          ),
          false,
        );
        await db.query(
          'update public.department_student_roster set active=false where id=$1',
          [r1],
        );
        assert.equal(
          (await api(counselor, `/api/follow-ups?assignment=${ids.a1}`)).total,
          0,
        );
        assert.equal(
          (await api(counselor, '/api/attention')).items.some(
            (x) => x.assignmentId === ids.escalationAssignment,
          ),
          false,
        );
        assert.ok(
          (
            await db.query(
              'select count(*)::int n from public.activity_follow_ups where id=$1',
              [ids.followup],
            )
          ).rows[0].n === 1,
        );
        assert.ok(
          (
            await db.query(
              'select count(*)::int n from public.counselor_student_mappings where roster_student_id=$1',
              [r1],
            )
          ).rows[0].n === 1,
        );
      },
    );
  } catch (error) {
    failure = error;
  } finally {
    if (connected)
      try {
        const all = users.map((x) => x.id);
        await db.query(
          `drop trigger if exists test_workflow_fail_${tag} on public.notification_outbox`,
        );
        await db.query(
          `drop function if exists public.test_workflow_fail_${tag}()`,
        );
        await db.query(
          'delete from public.notification_outbox where notification_id in (select id from public.notifications where recipient_id=any($1::uuid[]))',
          [all],
        );
        await db.query(
          'delete from public.notifications where recipient_id=any($1::uuid[])',
          [all],
        );
        await db.query(
          'delete from public.activity_escalation_history where escalation_id in (select id from public.activity_escalations where initiated_by=any($1::uuid[]))',
          [all],
        );
        await db.query(
          'delete from public.activity_escalations where initiated_by=any($1::uuid[])',
          [all],
        );
        await db.query(
          'delete from public.activity_follow_up_history where follow_up_id in (select id from public.activity_follow_ups where initiated_by=any($1::uuid[]))',
          [all],
        );
        await db.query(
          'delete from public.activity_follow_ups where initiated_by=any($1::uuid[])',
          [all],
        );
        await db.query(
          'delete from public.catch_up_history where request_id in (select id from public.catch_up_requests where student_id=any($1::uuid[]))',
          [all],
        );
        await db.query(
          'delete from public.catch_up_requests where student_id=any($1::uuid[])',
          [all],
        );
        await db.query(
          'delete from public.announcement_recipients where announcement_id in (select id from public.announcements where created_by=any($1::uuid[]))',
          [all],
        );
        await db.query(
          'delete from public.announcement_target_sections where announcement_id in (select id from public.announcements where created_by=any($1::uuid[]))',
          [all],
        );
        await db.query(
          'delete from public.announcements where created_by=any($1::uuid[])',
          [all],
        );
        await db.query(
          'delete from public.activity_completions where assignment_id in (select x.id from public.activity_assignments x join public.activities a on a.id=x.activity_id where a.created_by=any($1::uuid[]))',
          [all],
        );
        await db.query(
          'delete from public.activity_history where activity_id in (select id from public.activities where created_by=any($1::uuid[]))',
          [all],
        );
        await db.query(
          'delete from public.activity_target_sections where activity_id in (select id from public.activities where created_by=any($1::uuid[]))',
          [all],
        );
        await db.query(
          'delete from public.activity_assignments where activity_id in (select id from public.activities where created_by=any($1::uuid[]))',
          [all],
        );
        await db.query(
          'delete from public.activities where created_by=any($1::uuid[])',
          [all],
        );
        await db.query(
          'delete from public.escalation_routes where section_scope_id=any($1::uuid[])',
          [[ids.sectionA, ids.sectionB]],
        );
        await db.query(
          'delete from public.counselor_student_mappings where roster_student_id in (select id from public.department_student_roster where department_scope_id=$1)',
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
          'delete from public.activity_capabilities where responsibility_id in (select id from public.responsibility_assignments where user_id=any($1::uuid[]))',
          [all],
        );
        await db.query(
          'delete from public.responsibility_assignments where user_id=any($1::uuid[])',
          [all],
        );
        await db.query('delete from public.scopes where id=any($1::uuid[])', [
          [
            ids.sectionA,
            ids.sectionB,
            ids.outsideSection,
            ids.department,
            ids.outside,
          ],
        ]);
      } catch (error) {
        cleanupErrors.push(error.message);
      }
    for (const entry of users.toReversed())
      try {
        noDatabaseError(
          await admin.auth.admin.deleteUser(entry.id),
          'remove synthetic Auth account',
        );
      } catch (error) {
        cleanupErrors.push(`Auth ${entry.id}: ${error.message}`);
      }
    if (connected) await db.end();
  }
  if (failure || cleanupErrors.length) {
    console.error(
      `FAILED after ${passed} groups: ${failure?.stack ?? 'cleanup failed'}`,
    );
    for (const error of cleanupErrors)
      console.error(`CLEANUP REQUIRED: ${error}`);
    process.exitCode = 1;
  } else
    console.log(
      `PASS: ${passed} real follow-up, catch-up, attention, escalation, browser groups; synthetic fixtures removed.`,
    );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
