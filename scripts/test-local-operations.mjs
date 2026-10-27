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
  deniedWrite,
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
    query_timeout: 10000,
  });
  const ids = {
    department: randomUUID(),
    sectionA: randomUUID(),
    sectionB: randomUUID(),
    outside: randomUUID(),
    outsideSection: randomUUID(),
    failureFunction: `test_ops_outbox_failure_${tag}`,
    failureTrigger: `test_ops_outbox_failure_${tag}`,
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
  async function user(label, kind = 'student', login = true) {
    const entry = {
      email: `arkst-ops-${tag}-${label}@example.test`,
      password: `T!${randomBytes(24).toString('base64url')}`,
    };
    entry.id = noDatabaseError(
      await admin.auth.admin.createUser({ ...entry, email_confirm: true }),
      'create synthetic local Auth account',
    ).user.id;
    users.push(entry);
    noDatabaseError(
      await admin.from('profiles').insert({
        id: entry.id,
        display_name: `Operations ${label}`,
        account_kind: kind,
        staff_classification: kind === 'staff' ? 'teaching' : null,
        is_active: true,
      }),
      'provision synthetic profile',
    );
    if (login) {
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
    }
    return entry;
  }
  async function responsibility(person, role, scope) {
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
      'create synthetic responsibility',
    ).id;
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
  const count = async (sql, params = []) =>
    (await db.query(sql, params)).rows[0].n;
  const selectedInput = (studentIds, title, counselingOnly = false) => ({
    category: 'general',
    departmentScopeId: ids.department,
    studentIds,
    counselingOnly,
    title,
    description: 'Complete the work outside ARKST and report status here.',
    startsAt: new Date(Date.now() - 60000).toISOString(),
    deadlineAt: new Date(Date.now() + 3600000).toISOString(),
    endsAt: new Date(Date.now() + 7200000).toISOString(),
    requiresVerification: true,
  });
  try {
    await db.connect();
    connected = true;
    await db.query('select 1 from public.notification_outbox limit 0');
    await db.query(
      "insert into public.scopes(id,name,kind) values($1,$2,'department'),($3,$4,'department')",
      [ids.department, `Operations ${tag}`, ids.outside, `Outside ${tag}`],
    );
    await db.query(
      "insert into public.scopes(id,name,kind,parent_id) values($1,'Section A','section',$4),($2,'Section B','section',$4),($3,'Outside Section','section',$5)",
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
    const unapproved = await user('unapproved', 'staff');
    const students = [];
    for (let i = 0; i < 6; i++) students.push(await user(`student-${i + 1}`));
    const outsider = await user('outsider');
    const teacherResp = await responsibility(
      teacher,
      'teacher',
      ids.department,
    );
    const teacherCounselorResp = await responsibility(
      teacher,
      'counselor',
      ids.department,
    );
    const counselorResp = await responsibility(
      counselor,
      'counselor',
      ids.department,
    );
    const outsideResp = await responsibility(
      unapproved,
      'teacher',
      ids.outside,
    );
    noDatabaseError(
      await admin.from('activity_capabilities').insert({
        responsibility_id: teacherResp,
        category_key: 'general',
        can_create: true,
      }),
      'approve exact synthetic CREATE capability',
    );
    noDatabaseError(
      await admin.from('activity_capabilities').insert({
        responsibility_id: outsideResp,
        category_key: 'general',
        can_create: true,
      }),
      'approve unrelated outside-department CREATE capability',
    );
    const roster = [];
    for (let i = 0; i < students.length; i++) {
      const section = i < 3 ? ids.sectionA : ids.sectionB;
      const row = noDatabaseError(
        await admin
          .from('department_student_roster')
          .insert({
            department_scope_id: ids.department,
            section_scope_id: section,
            external_student_id: `OPS-${i + 1}-${tag}`,
            display_name: `Synthetic Student ${i + 1}`,
            linked_student_id: students[i].id,
            created_by: teacher.id,
          })
          .select('id')
          .single(),
        'create synthetic roster row',
      );
      roster.push(row.id);
      noDatabaseError(
        await admin.from('student_scope_memberships').insert({
          student_id: students[i].id,
          scope_id: section,
        }),
        'create exact section membership',
      );
      noDatabaseError(
        await admin.from('counselor_student_mappings').insert({
          roster_student_id: row.id,
          counselor_responsibility_id:
            i === 5 ? teacherCounselorResp : counselorResp,
          created_by: teacher.id,
        }),
        'create trusted synthetic counselor mapping',
      );
    }
    noDatabaseError(
      await admin.from('student_scope_memberships').insert({
        student_id: outsider.id,
        scope_id: ids.outsideSection,
      }),
      'create outside membership',
    );

    await check(
      'anonymous requests cannot read or publish operational records',
      async () => {
        const anonymous = new AppBrowser(config.appOrigin);
        assert.equal(
          (await anonymous.request('/api/notifications')).status,
          401,
        );
        assert.equal(
          (
            await anonymous.request(
              `/api/activities/candidates?department=${ids.department}&category=general`,
            )
          ).status,
          401,
        );
        assert.equal(
          (
            await anonymous.request('/api/announcements', {
              method: 'POST',
              headers: {
                Origin: config.appOrigin,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                departmentScopeId: ids.department,
                mode: 'sections',
                sectionIds: [ids.sectionA],
                title: 'Denied',
                message: 'Denied',
              }),
            })
          ).status,
          401,
        );
      },
    );

    await check(
      'candidate search exposes only real eligible names in current CREATE scope',
      async () => {
        const params = new URLSearchParams({
          department: ids.department,
          category: 'general',
          counselingOnly: 'false',
        });
        const result = await api(
          teacher,
          `/api/activities/candidates?${params}`,
        );
        assert.equal(result.total, 6);
        assert.deepEqual(
          result.students.map((row) => row.studentId).sort(),
          students.map((row) => row.id).sort(),
        );
        const mapped = await api(
          teacher,
          `/api/activities/candidates?${params}&counselingOnly=true`,
          undefined,
          400,
        );
        assert.ok(mapped.error);
        params.set('counselingOnly', 'true');
        const own = await api(teacher, `/api/activities/candidates?${params}`);
        assert.deepEqual(
          own.students.map((row) => row.studentId),
          [students[5].id],
        );
        assert.equal(
          (await api(unapproved, `/api/activities/candidates?${params}`)).total,
          0,
        );
        assert.equal(
          (await api(students[0], `/api/activities/candidates?${params}`))
            .total,
          0,
        );
      },
    );

    let selectedId;
    await check(
      'real Edge browser assigns six named students, persists report, and shows full creator/counselor progress',
      async () => {
        const browser = await chromium.launch({
          channel: 'msedge',
          headless: true,
        });
        const title = `Selected six ${tag}`;
        async function login(person, viewport = { width: 1280, height: 820 }) {
          const context = await browser.newContext({ viewport });
          const page = await context.newPage();
          await page.goto(`${config.appOrigin}/login`);
          await page.getByLabel('Email').fill(person.email);
          await page.getByLabel('Password').fill(person.password);
          await page
            .getByRole('button', { name: 'Sign in to local Supabase' })
            .click();
          await expect(page).toHaveURL(`${config.appOrigin}/profile`);
          return { context, page };
        }
        try {
          const faculty = await login(teacher);
          await faculty.page.goto(`${config.appOrigin}/dashboard/faculty`);
          const create = faculty.page.locator(
            'section[aria-labelledby="create-heading"]',
          );
          await create.getByLabel('Assign to').selectOption('selected');
          await expect(create.locator('.dashboard-roster li')).toHaveCount(6);
          for (let i = 1; i <= 6; i++)
            await create
              .getByRole('checkbox', {
                name: new RegExp(`Synthetic Student ${i} \\u00b7 OPS-${i}-`),
              })
              .check();
          await create.getByRole('textbox', { name: 'Title' }).fill(title);
          await create
            .getByRole('textbox', { name: 'Description' })
            .fill('External work; status only.');
          const dates = await faculty.page.evaluate(() => {
            const local = (delta) => {
              const date = new Date(Date.now() + delta);
              return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
                .toISOString()
                .slice(0, 16);
            };
            return [local(-60000), local(3600000), local(7200000)];
          });
          for (const [label, value] of [
            ['Start', dates[0]],
            ['Deadline', dates[1]],
            ['Window end', dates[2]],
          ])
            await create.getByLabel(label).fill(value);
          await create
            .getByRole('checkbox', {
              name: /Require authorized staff verification/,
            })
            .check();
          await create
            .getByRole('button', { name: 'Publish activity' })
            .evaluate((button) => {
              button.click();
              button.click();
            });
          await expect(
            create.getByText('Saved one activity with 6 assigned students.'),
          ).toBeVisible();
          const selectedRows = await db.query(
            'select id from public.activities where title=$1 and created_by=$2',
            [title, teacher.id],
          );
          assert.equal(
            selectedRows.rows.length,
            1,
            'double click must publish once',
          );
          selectedId = selectedRows.rows[0].id;
          const mobile = await login(students[0], { width: 390, height: 844 });
          await mobile.page.goto(`${config.appOrigin}/dashboard/notifications`);
          await expect(mobile.page.getByText(title)).toBeVisible();
          await mobile.page
            .getByRole('link', { name: 'Open activity' })
            .click();
          await expect(
            mobile.page.getByRole('heading', { name: title }),
          ).toBeVisible();
          await mobile.page
            .getByRole('button', { name: 'Report completion' })
            .click();
          await expect(
            mobile.page.locator('.dashboard-state-awaiting'),
          ).toBeVisible();
          await mobile.page.reload();
          await expect(
            mobile.page.locator('.dashboard-state-awaiting'),
          ).toBeVisible();
          assert.equal(
            await mobile.page.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
            true,
          );
          await mobile.context.close();
          const counsel = await login(counselor);
          await counsel.context.grantPermissions([
            'clipboard-read',
            'clipboard-write',
          ]);
          await counsel.page.goto(`${config.appOrigin}/dashboard/counselor`);
          const summary = counsel.page
            .locator('.dashboard-card')
            .filter({ hasText: title });
          await expect(summary).toContainText('20% reported');
          await summary.getByRole('link', { name: /View students/ }).click();
          await expect(
            counsel.page.getByRole('heading', { name: 'Synthetic Student 1' }),
          ).toBeVisible();
          await expect(
            counsel.page.getByText('OPS-1-', { exact: false }),
          ).toBeVisible();
          await counsel.page
            .getByRole('button', { name: 'Copy Pending Students' })
            .click();
          await expect(
            counsel.page.getByText(
              'Copied the complete list of 4 pending students.',
            ),
          ).toBeVisible();
          const copied = await counsel.page.evaluate(() =>
            navigator.clipboard.readText(),
          );
          assert.match(copied, /Synthetic Student 2/);
          assert.doesNotMatch(
            copied,
            /Synthetic Student 1|Synthetic Student 6/,
          );
          await counsel.context.close();
          const announce = faculty.page.locator(
            'section[aria-labelledby="announcement-heading"]',
          );
          await faculty.page.goto(`${config.appOrigin}/dashboard/faculty`);
          await announce.getByRole('checkbox', { name: /Section A/ }).check();
          await announce.getByRole('checkbox', { name: /Section B/ }).check();
          await announce
            .getByRole('textbox', { name: 'Title' })
            .fill(`No weekly tests ${tag}`);
          await announce
            .getByRole('textbox', { name: 'Message' })
            .fill('No weekly tests this week due to internal examinations.');
          await announce
            .getByRole('button', { name: 'Publish announcement' })
            .click();
          await expect(
            announce.getByText('Saved for 6 students.'),
          ).toBeVisible();
          const reconnectedStudent = await login(students[0], {
            width: 390,
            height: 844,
          });
          await reconnectedStudent.page.goto(
            `${config.appOrigin}/dashboard/notifications`,
          );
          await expect(
            reconnectedStudent.page.getByText(`No weekly tests ${tag}`),
          ).toBeVisible();
          await reconnectedStudent.page
            .getByRole('link', { name: 'Open announcement' })
            .click();
          await expect(
            reconnectedStudent.page.getByRole('heading', {
              name: `No weekly tests ${tag}`,
            }),
          ).toBeVisible();
          await faculty.context.close();
          await reconnectedStudent.context.close();
        } finally {
          await browser.close();
        }
      },
    );

    await check(
      'six exact assignments and inbox/outbox events persist without unrelated recipients',
      async () => {
        assert.equal(
          await count(
            'select count(*)::int n from public.activity_assignments where activity_id=$1',
            [selectedId],
          ),
          6,
        );
        assert.equal(
          await count(
            'select count(*)::int n from public.notifications where source_kind=$1 and source_id=$2',
            ['activity', selectedId],
          ),
          6,
        );
        assert.equal(
          await count(
            'select count(*)::int n from public.notification_outbox o join public.notifications n on n.id=o.notification_id where n.source_id=$1',
            [selectedId],
          ),
          6,
        );
        assert.equal(
          (await api(outsider, `/api/activities/${selectedId}`, undefined, 404))
            .error,
          'Activity is unavailable.',
        );
        assert.equal((await api(outsider, '/api/notifications')).total, 0);
        assert.equal((await api(students[0], '/api/notifications')).unread, 2);
        const report = await api(
          teacher,
          `/api/activities/${selectedId}/monitor`,
        );
        assert.equal(report.totalAssigned, 6);
        assert.equal(report.awaitingVerification, 1);
        assert.equal(report.pending, 5);
        const counselorView = await api(
          counselor,
          `/api/counselor/activities/${selectedId}`,
        );
        assert.equal(counselorView.totalAssigned, 5);
        assert.equal(counselorView.awaitingVerification, 1);
        assert.equal(counselorView.pending, 4);
        assert.equal(
          (
            await api(counselor, '/api/counselor/activity-summaries')
          ).activities.find((row) => row.activityId === selectedId)
            .totalAssigned,
          5,
        );
        assert.equal(
          (
            await api(
              teacher,
              `/api/activities/${selectedId}/pending?view=creator`,
            )
          ).count,
          5,
        );
        assert.equal(
          (
            await api(
              counselor,
              `/api/activities/${selectedId}/pending?view=counselor`,
            )
          ).count,
          4,
        );
        await api(
          unapproved,
          `/api/activities/${selectedId}/pending?view=creator`,
          undefined,
          403,
        );
        await api(
          counselor,
          `/api/activities/${selectedId}/monitor`,
          undefined,
          403,
        );
        await api(
          students[0],
          `/api/activities/${selectedId}/pending?view=creator`,
          undefined,
          403,
        );
      },
    );

    await check(
      'announcement creates only recipient messages, never a completion obligation',
      async () => {
        const announcement = (
          await db.query(
            'select id from public.announcements where created_by=$1',
            [teacher.id],
          )
        ).rows[0];
        assert.ok(announcement?.id);
        assert.equal(
          await count(
            'select count(*)::int n from public.announcement_recipients where announcement_id=$1',
            [announcement.id],
          ),
          6,
        );
        assert.equal(
          await count(
            'select count(*)::int n from public.notifications where source_kind=$1 and source_id=$2',
            ['announcement', announcement.id],
          ),
          6,
        );
        assert.equal(
          await count(
            'select count(*)::int n from public.activities where title=$1',
            [`No weekly tests ${tag}`],
          ),
          0,
        );
        assert.equal(
          (await api(students[0], `/api/announcements/${announcement.id}`))
            .announcement.title,
          `No weekly tests ${tag}`,
        );
        await api(
          outsider,
          `/api/announcements/${announcement.id}`,
          undefined,
          404,
        );
        await api(
          unapproved,
          `/api/announcements/${announcement.id}`,
          undefined,
          404,
        );
        const before = await count(
          'select count(*)::int n from public.notifications where source_id=$1',
          [announcement.id],
        );
        await db.query(
          `insert into public.notifications(recipient_id,source_kind,source_id,title,message)
        values($1,'announcement',$2,'Duplicate','Duplicate') on conflict(recipient_id,source_kind,source_id) do nothing`,
          [students[0].id, announcement.id],
        );
        assert.equal(
          await count(
            'select count(*)::int n from public.notifications where source_id=$1',
            [announcement.id],
          ),
          before,
        );
        assert.equal(
          await count(
            `select count(*)::int n from public.notification_outbox o
        join public.notifications n on n.id=o.notification_id where n.source_id=$1`,
            [announcement.id],
          ),
          6,
        );
      },
    );

    await check(
      'read state, unauthorized mutations and invalid saves are rejected or persisted accurately',
      async () => {
        const inbox = await api(students[0], '/api/notifications');
        const note = inbox.notifications.find(
          (row) => row.source_kind === 'activity',
        );
        await api(students[0], `/api/notifications/${note.id}/read`, {});
        assert.equal((await api(students[0], '/api/notifications')).unread, 1);
        await api(students[0], `/api/notifications/${note.id}/read`, {});
        await api(students[1], `/api/notifications/${note.id}/read`, {}, 403);
        deniedWrite(
          await students[0].client
            .from('notifications')
            .update({ read_at: new Date().toISOString() })
            .eq('id', note.id),
        );
        const invalid = selectedInput(
          [students[0].id, students[0].id],
          `Duplicate ${tag}`,
        );
        await api(teacher, '/api/activities/selected', invalid, 400);
        await api(
          teacher,
          '/api/activities/selected',
          selectedInput([outsider.id], `Outside ${tag}`),
          403,
        );
        await api(
          counselor,
          '/api/activities/selected',
          selectedInput([students[0].id], `No grant ${tag}`),
          403,
        );
        await api(
          students[0],
          '/api/activities/selected',
          selectedInput([students[0].id], `Student ${tag}`),
          403,
        );
        await api(
          teacher,
          '/api/activities/selected',
          selectedInput(
            students.slice(0, 5).map((x) => x.id),
            `Wrong counseling ${tag}`,
            true,
          ),
          403,
        );
        await api(
          teacher,
          '/api/announcements',
          {
            departmentScopeId: ids.department,
            mode: 'selected',
            studentIds: [outsider.id],
            title: `Wrong announcement ${tag}`,
            message: 'Must not publish.',
          },
          403,
        );
        assert.equal(
          await count(
            'select count(*)::int n from public.activities where title like $1',
            [`%${tag}%`],
          ),
          1,
        );
        assert.equal(
          await count(
            'select count(*)::int n from public.announcements where created_by=$1',
            [teacher.id],
          ),
          1,
        );
      },
    );

    await check(
      'a counselor with separate CREATE approval can target only their trusted mapped students',
      async () => {
        const result = await api(
          teacher,
          '/api/activities/selected',
          selectedInput([students[5].id], `Counselor scoped ${tag}`, true),
          201,
        );
        assert.equal(result.assignedCount, 1);
        assert.equal(
          (await api(students[5], `/api/activities/${result.id}`)).activity.id,
          result.id,
        );
        await api(students[0], `/api/activities/${result.id}`, undefined, 404);
      },
    );

    await check(
      'outbox write failure returns 503 and rolls back both publication kinds',
      async () => {
        await db.query(`create function public.${ids.failureFunction}() returns trigger
        language plpgsql as $$ begin raise exception 'Synthetic outbox failure'
        using errcode='P0001'; end $$`);
        await db.query(`create trigger ${ids.failureTrigger} before insert on public.notification_outbox
        for each row execute function public.${ids.failureFunction}()`);
        try {
          await api(
            teacher,
            '/api/announcements',
            {
              departmentScopeId: ids.department,
              mode: 'selected',
              studentIds: [students[0].id],
              title: `Failed announcement ${tag}`,
              message: 'Must roll back.',
            },
            503,
          );
          await api(
            teacher,
            '/api/activities/selected',
            selectedInput([students[0].id], `Failed activity ${tag}`),
            503,
          );
          assert.equal(
            await count(
              'select count(*)::int n from public.announcements where title=$1',
              [`Failed announcement ${tag}`],
            ),
            0,
          );
          assert.equal(
            await count(
              'select count(*)::int n from public.activities where title=$1',
              [`Failed activity ${tag}`],
            ),
            0,
          );
        } finally {
          await db.query(
            `drop trigger if exists ${ids.failureTrigger} on public.notification_outbox`,
          );
          await db.query(
            `drop function if exists public.${ids.failureFunction}()`,
          );
        }
      },
    );

    await check(
      'a list over 50 students still copies the complete authorized pending set',
      async () => {
        const bulk = [];
        for (let i = 0; i < 55; i++) {
          const extra = await user(`bulk-${i}`, 'student', false);
          bulk.push(extra);
          noDatabaseError(
            await admin.from('student_scope_memberships').insert({
              student_id: extra.id,
              scope_id: ids.sectionA,
            }),
            'large-list membership',
          );
          noDatabaseError(
            await admin.from('department_student_roster').insert({
              department_scope_id: ids.department,
              section_scope_id: ids.sectionA,
              external_student_id: `BULK-${i}-${tag}`,
              display_name: `Bulk Student ${i}`,
              linked_student_id: extra.id,
              created_by: teacher.id,
            }),
            'large-list roster row',
          );
        }
        const section = await api(
          teacher,
          '/api/activities/sections',
          {
            category: 'general',
            departmentScopeId: ids.department,
            sectionIds: [ids.sectionA],
            title: `Large section ${tag}`,
            description: '',
            startsAt: new Date(Date.now() - 60000).toISOString(),
            deadlineAt: new Date(Date.now() + 3600000).toISOString(),
            endsAt: new Date(Date.now() + 7200000).toISOString(),
            requiresVerification: false,
          },
          201,
        );
        assert.equal(section.assignedCount, 58);
        const monitor = await api(
          teacher,
          `/api/activities/${section.id}/monitor`,
        );
        assert.equal(monitor.totalAssigned, 58);
        assert.equal(monitor.assignments.length, 50);
        const pending = await api(
          teacher,
          `/api/activities/${section.id}/pending?view=creator`,
        );
        assert.equal(pending.count, 58);
        assert.match(
          pending.text,
          new RegExp(`Bulk Student 54 \\(BULK-54-${tag}\\)`),
        );
        assert.equal((pending.text.match(/Bulk Student 54/g) ?? []).length, 1);
        const candidates = await api(
          teacher,
          `/api/activities/candidates?department=${ids.department}&category=general&offset=50`,
        );
        assert.equal(candidates.total, 61);
        assert.equal(candidates.students.length, 11);
      },
    );
  } catch (error) {
    failure = error;
  } finally {
    if (connected) {
      try {
        await db.query(
          `drop trigger if exists ${ids.failureTrigger} on public.notification_outbox`,
        );
        await db.query(
          `drop function if exists public.${ids.failureFunction}()`,
        );
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
          'delete from public.counselor_student_mappings where roster_student_id in (select id from public.department_student_roster where department_scope_id=$1)',
          [ids.department],
        );
        await db.query(
          'delete from public.department_student_roster where department_scope_id=$1',
          [ids.department],
        );
        await db.query(
          'delete from public.student_scope_memberships where scope_id=any($1::uuid[])',
          [[ids.sectionA, ids.sectionB, ids.outsideSection]],
        );
        await db.query(
          'delete from public.activity_capabilities where responsibility_id in (select id from public.responsibility_assignments where user_id=any($1::uuid[]))',
          [allIds],
        );
        await db.query(
          'delete from public.responsibility_assignments where user_id=any($1::uuid[])',
          [allIds],
        );
      } catch (error) {
        cleanupErrors.push(`database fixture: ${error.message}`);
      }
    }
    for (const entry of users.toReversed()) {
      try {
        noDatabaseError(
          await admin.auth.admin.deleteUser(entry.id),
          'remove local test Auth account',
        );
      } catch (error) {
        cleanupErrors.push(`Auth ${entry.id}: ${error.message}`);
      }
    }
    if (connected) {
      try {
        await db.query('delete from public.scopes where id=any($1::uuid[])', [
          [ids.sectionA, ids.sectionB, ids.outsideSection],
        ]);
        await db.query('delete from public.scopes where id=any($1::uuid[])', [
          [ids.department, ids.outside],
        ]);
        assert.equal(
          await count(
            'select count(*)::int n from public.profiles where id=any($1::uuid[])',
            [users.map((x) => x.id)],
          ),
          0,
        );
      } catch (error) {
        cleanupErrors.push(`scopes/remaining accounts: ${error.message}`);
      }
      await db.end();
    }
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
      `PASS: ${passed} real Milestone 4 Auth/PostgreSQL/API/browser groups; synthetic fixtures removed.`,
    );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
