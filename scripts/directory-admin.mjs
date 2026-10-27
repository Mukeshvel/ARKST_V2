// Trusted, local-only operator workflows. Preview is read-only; --apply is one DB transaction.
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { localUrl } from '../tests/integration/local-helpers.mjs';

function args(argv) {
  const [command, ...rest] = argv;
  const out = { command };
  for (let i = 0; i < rest.length; i++) {
    const key = rest[i];
    if (key === '--apply') {
      out.apply = true;
      continue;
    }
    if (!key.startsWith('--') || !rest[i + 1])
      throw new Error(`Invalid argument: ${key}`);
    out[key.slice(2)] = rest[++i];
  }
  return out;
}

function csv(text) {
  const rows = [];
  let row = [],
    field = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
      continue;
    }
    if (c === '"' && field === '') {
      quoted = true;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (c === '\n') {
      row.push(field.replace(/\r$/, ''));
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
      field = '';
      continue;
    }
    field += c;
  }
  if (quoted) throw new Error('CSV has an unterminated quoted field.');
  if (field !== '' || row.length) {
    row.push(field.replace(/\r$/, ''));
    if (row.some((x) => x !== '')) rows.push(row);
  }
  if (!rows.length) throw new Error('CSV is empty.');
  const headers = rows.shift();
  if (new Set(headers).size !== headers.length || headers.some((x) => !x))
    throw new Error('CSV headers must be non-empty and unique.');
  return rows.map((values, index) => {
    if (values.length !== headers.length)
      throw new Error(
        `CSV row ${index + 2} has ${values.length} fields; expected ${headers.length}.`,
      );
    return Object.fromEntries(headers.map((key, i) => [key, values[i].trim()]));
  });
}

const uuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value ?? '',
  );
async function main() {
  const options = args(process.argv.slice(2));
  if (
    ![
      'provision-staff',
      'import-roster',
      'import-counselors',
      'reassign-counselors',
      'revoke-counselors',
    ].includes(options.command)
  )
    throw new Error(
      'Use provision-staff, import-roster, import-counselors, reassign-counselors or revoke-counselors.',
    );
  const connection = process.env.LOCAL_DATABASE_URL;
  if (!connection)
    throw new Error(
      'Set LOCAL_DATABASE_URL to the isolated local Supabase database.',
    );
  localUrl(
    connection,
    ['postgres:', 'postgresql:'],
    'LOCAL_DATABASE_URL',
    true,
  );
  if (!uuid(options.operator) || !uuid(options.department))
    throw new Error('A valid --operator and --department are required.');
  const db = new pg.Client({
    connectionString: connection,
    connectionTimeoutMillis: 5000,
    query_timeout: 10000,
  });
  await db.connect();
  let inTransaction = false;
  try {
    const operator = await db.query(
      `select 1 from public.profiles p join public.responsibility_assignments r on r.user_id=p.id
      where p.id=$1 and p.is_active and p.account_kind='staff' and r.role='admin' and r.scope_id=$2
      and r.starts_at<=now() and (r.ends_at is null or now()<r.ends_at)`,
      [options.operator, options.department],
    );
    if (!operator.rowCount)
      throw new Error(
        'Operator must be an active staff member with a current admin responsibility in this exact department.',
      );
    const dept = await db.query(
      "select id from public.scopes where id=$1 and kind='department'",
      [options.department],
    );
    if (!dept.rowCount)
      throw new Error('--department must identify a department scope.');

    if (
      ['reassign-counselors', 'revoke-counselors'].includes(options.command)
    ) {
      if (!options.file)
        throw new Error(
          'An administrator-approved CSV is required via --file.',
        );
      const records = csv(await readFile(options.file, 'utf8'));
      const reassign = options.command === 'reassign-counselors';
      const expected = reassign
        ? 'student_identifier|counselor_responsibility_id'
        : 'student_identifier';
      if (
        !records.length ||
        records.length > 10000 ||
        Object.keys(records[0]).join('|') !== expected
      )
        throw new Error(
          `CSV requires 1–10,000 rows and headers: ${expected.replaceAll('|', ',')}`,
        );
      const identifiers = records.map((r) => r.student_identifier);
      if (
        identifiers.some((x) => !x || x.length > 80) ||
        new Set(identifiers).size !== identifiers.length
      )
        throw new Error(
          'Each student identifier must be unique and non-empty.',
        );
      if (reassign && records.some((r) => !uuid(r.counselor_responsibility_id)))
        throw new Error('Each new counselor responsibility must be a UUID.');
      console.log(
        `PREVIEW: ${records.length} ${reassign ? 'reassignment' : 'revocation'} row(s).`,
      );
      if (options.apply) {
        await db.query('begin');
        inTransaction = true;
        const currentOperator = await db.query(
          `select r.id from public.profiles p join public.responsibility_assignments r on r.user_id=p.id
           where p.id=$1 and p.is_active and p.account_kind='staff' and r.role='admin' and r.scope_id=$2
             and r.starts_at<=now() and (r.ends_at is null or now()<r.ends_at) for share of r`,
          [options.operator, options.department],
        );
        if (!currentOperator.rowCount)
          throw new Error(
            'Operator admin responsibility is no longer current.',
          );
      }
      // All writers using this operator workflow lock roster rows in the same order.
      for (const record of [...records].sort((a, b) =>
        a.student_identifier.localeCompare(b.student_identifier),
      )) {
        const student = await db.query(
          `select id,section_scope_id,active from public.department_student_roster
           where department_scope_id=$1 and external_student_id=$2 ${options.apply ? 'for update' : ''}`,
          [options.department, record.student_identifier],
        );
        if (student.rowCount !== 1 || !student.rows[0].active)
          throw new Error(
            `Student ${record.student_identifier} must have one active roster row.`,
          );
        const row = student.rows[0];
        if (reassign) {
          const counselor = await db.query(
            `select r.id from public.responsibility_assignments r join public.profiles p on p.id=r.user_id
             where r.id=$1 and r.role='counselor' and p.is_active and p.account_kind='staff'
               and r.starts_at<=now() and (r.ends_at is null or now()<r.ends_at)
               and r.scope_id in ($2,$3)`,
            [
              record.counselor_responsibility_id,
              options.department,
              row.section_scope_id,
            ],
          );
          if (!counselor.rowCount)
            throw new Error(
              `Student ${record.student_identifier}: new counselor is not approved for this scope.`,
            );
        }
        const current = await db.query(
          `select id,counselor_responsibility_id from public.counselor_student_mappings
           where roster_student_id=$1 and starts_at<=now() and (ends_at is null or now()<ends_at)
           ${options.apply ? 'for update' : ''}`,
          [row.id],
        );
        if (current.rowCount > 1)
          throw new Error('Overlapping current mappings require review.');
        if (!reassign && !current.rowCount)
          throw new Error(
            `Student ${record.student_identifier} has no current counselor.`,
          );
        if (
          reassign &&
          current.rows[0]?.counselor_responsibility_id ===
            record.counselor_responsibility_id
        )
          throw new Error(
            `Student ${record.student_identifier} already has that counselor.`,
          );
        const future = await db.query(
          'select 1 from public.counselor_student_mappings where roster_student_id=$1 and starts_at>now()',
          [row.id],
        );
        if (future.rowCount)
          throw new Error(
            `Student ${record.student_identifier} has a scheduled future mapping requiring review.`,
          );
        console.log(
          `PREVIEW ${JSON.stringify({ studentIdentifier: record.student_identifier, previous: current.rows[0]?.counselor_responsibility_id ?? null, next: reassign ? record.counselor_responsibility_id : null })}`,
        );
        if (!options.apply) continue;
        // A single transaction timestamp makes the old [start,end) and new [start,end) adjacent.
        if (current.rowCount)
          await db.query(
            'update public.counselor_student_mappings set ends_at=transaction_timestamp() where id=$1',
            [current.rows[0].id],
          );
        let newId = null;
        if (reassign) {
          const inserted = await db.query(
            `insert into public.counselor_student_mappings(roster_student_id,counselor_responsibility_id,starts_at,created_by)
             values($1,$2,transaction_timestamp(),$3) returning id`,
            [row.id, record.counselor_responsibility_id, options.operator],
          );
          newId = inserted.rows[0].id;
        }
        await db.query(
          `insert into public.department_directory_audit(actor_id,entity_type,entity_id,action,changes)
           values($1,'counselor_mapping',$2,'updated',$3)`,
          [
            options.operator,
            newId ?? current.rows[0].id,
            {
              student_identifier: record.student_identifier,
              previous: current.rows[0]?.counselor_responsibility_id ?? null,
              next: reassign ? record.counselor_responsibility_id : null,
            },
          ],
        );
      }
      if (!options.apply)
        console.log('PREVIEW ONLY. No records written. Add --apply to commit.');
      else {
        await db.query('commit');
        inTransaction = false;
        console.log(
          `COMMITTED: ${records.length} counselor change(s); mapping history retained.`,
        );
      }
      return;
    }

    if (options.command === 'provision-staff') {
      if (
        !uuid(options.user) ||
        !['teaching', 'non_teaching'].includes(options.status ?? '') ||
        ![
          'teacher',
          'counselor',
          'coordinator',
          'placement_coordinator',
          'branch_coordinator',
        ].includes(options.role ?? '')
      )
        throw new Error(
          'provision-staff requires --user, --status teaching|non_teaching and an approved ordinary --role. HOD/Admin grants use a separate process.',
        );
      const sections = (options.sections ?? '').split(',').filter(Boolean);
      const categories = (options.categories ?? '').split(',').filter(Boolean);
      if (
        !sections.length ||
        sections.some((x) => !uuid(x)) ||
        new Set(sections).size !== sections.length
      )
        throw new Error(
          '--sections must be one or more distinct approved section UUIDs.',
        );
      if (!categories.length || new Set(categories).size !== categories.length)
        throw new Error('--categories must list approved Activity categories.');
      const target = await db.query(
        'select u.id from auth.users u left join public.profiles p on p.id=u.id where u.id=$1 and u.email_confirmed_at is not null and p.id is null',
        [options.user],
      );
      if (!target.rowCount)
        throw new Error(
          'Target must be a confirmed existing Auth user without a profile; no account is created by this command. An administrator must verify staff identity separately.',
        );
      const sectionRows = await db.query(
        "select id from public.scopes where id=any($1::uuid[]) and kind='section' and parent_id=$2",
        [sections, options.department],
      );
      if (sectionRows.rowCount !== sections.length)
        throw new Error(
          'Every section must belong directly to the approved department.',
        );
      const catRows = await db.query(
        'select key from public.activity_categories where key=any($1::text[])',
        [categories],
      );
      if (catRows.rowCount !== categories.length)
        throw new Error('Unknown Activity category.');
      console.log(
        `VALID: provision one confirmed existing user, role ${options.role}, ${sections.length} section(s), ${categories.length} category create grants.`,
      );
      console.log(
        `PREVIEW ${JSON.stringify({
          userId: options.user,
          department: options.department,
          status: options.status,
          role: options.role,
          preferredSections: sections,
          activityCategories: categories,
        })}`,
      );
      if (!options.apply) {
        console.log(
          'PREVIEW ONLY. No records written. Add --apply to commit this validated transaction.',
        );
        return;
      }
      await db.query('begin');
      inTransaction = true;
      await db.query(
        "insert into public.profiles(id,display_name,account_kind,staff_classification,is_active) select u.id,coalesce(nullif(u.raw_user_meta_data->>'full_name',''),split_part(u.email,'@',1)),'staff',$2,true from auth.users u where u.id=$1",
        [options.user, options.status],
      );
      await db.query(
        "insert into public.staff_directory_profiles(user_id,teaching_status,designation,subjects,updated_by) values($1,$2,$3,'{}',$4)",
        [
          options.user,
          options.status,
          options.designation ?? '',
          options.operator,
        ],
      );
      await db.query(
        'insert into public.staff_section_preferences(user_id,section_scope_id) select $1,x from unnest($2::uuid[]) x',
        [options.user, sections],
      );
      const responsibility = await db.query(
        'insert into public.responsibility_assignments(user_id,role,scope_id) values($1,$2,$3) returning id',
        [options.user, options.role, options.department],
      );
      await db.query(
        'insert into public.activity_capabilities(responsibility_id,category_key,can_create,can_verify) select $1,key,true,false from unnest($2::text[]) key',
        [responsibility.rows[0].id, categories],
      );
      await db.query(
        "insert into public.department_directory_audit(actor_id,entity_type,entity_id,action,changes) values($1,'staff_provisioning',$2,'created',$3)",
        [
          options.operator,
          options.user,
          {
            department: options.department,
            role: options.role,
            sections,
            categories,
            status: options.status,
          },
        ],
      );
      await db.query('commit');
      inTransaction = false;
      console.log(
        'COMMITTED: existing Auth user provisioned; no Auth account was created.',
      );
      return;
    }

    if (!options.file)
      throw new Error('An administrator-approved CSV is required via --file.');
    const content = await readFile(options.file, 'utf8');
    const records = csv(content);
    const expected =
      options.command === 'import-roster'
        ? [
            'student_identifier',
            'display_name',
            'section_scope_id',
            'linked_student_id',
          ]
        : ['student_identifier', 'counselor_responsibility_id', 'starts_at'];
    if (records.length < 1 || records.length > 10000)
      throw new Error('CSV must contain 1–10,000 data rows.');
    if (Object.keys(records[0]).join('|') !== expected.join('|'))
      throw new Error(`CSV header must be exactly: ${expected.join(',')}`);
    const ids = records.map((x) => x.student_identifier);
    if (
      ids.some((x) => !x || x.length > 80) ||
      new Set(ids).size !== ids.length
    )
      throw new Error(
        'Student identifiers must be non-empty unique external strings; sequential numbers are not assumed.',
      );
    const roster = [];
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const found = await db.query(
        'select id,section_scope_id,linked_student_id from public.department_student_roster where department_scope_id=$1 and external_student_id=$2',
        [options.department, r.student_identifier],
      );
      if (options.command === 'import-roster') {
        if (found.rowCount)
          throw new Error(
            `Row ${i + 2}: student_identifier already exists; imports never overwrite roster data.`,
          );
        if (
          !r.display_name ||
          r.display_name.length > 160 ||
          !uuid(r.section_scope_id) ||
          (!['', 'null'].includes(r.linked_student_id) &&
            !uuid(r.linked_student_id))
        )
          throw new Error(
            `Row ${i + 2}: invalid display name, section or linked profile UUID.`,
          );
        const section = await db.query(
          "select id from public.scopes where id=$1 and kind='section' and parent_id=$2",
          [r.section_scope_id, options.department],
        );
        if (!section.rowCount)
          throw new Error(
            `Row ${i + 2}: section is not a direct child of this department.`,
          );
        const linked =
          r.linked_student_id && r.linked_student_id !== 'null'
            ? r.linked_student_id
            : null;
        if (linked) {
          const profile = await db.query(
            "select id from public.profiles where id=$1 and account_kind='student' and is_active",
            [linked],
          );
          if (!profile.rowCount)
            throw new Error(
              `Row ${i + 2}: linked student is not active/provisioned.`,
            );
        }
        roster.push({ ...r, linked_student_id: linked });
      } else {
        if (found.rowCount !== 1)
          throw new Error(
            `Row ${i + 2}: roster student not found exactly once.`,
          );
        if (!uuid(r.counselor_responsibility_id))
          throw new Error(
            `Row ${i + 2}: invalid counselor responsibility UUID.`,
          );
        const starts = new Date(r.starts_at);
        if (
          !Number.isFinite(starts.getTime()) ||
          starts.toISOString() !== r.starts_at
        )
          throw new Error(
            `Row ${i + 2}: starts_at must be canonical UTC ISO timestamp.`,
          );
        const counselor = await db.query(
          `select r.id from public.responsibility_assignments r join public.profiles p on p.id=r.user_id
          where r.id=$1 and r.role='counselor' and p.is_active and p.account_kind='staff' and r.starts_at<=now()
            and (r.ends_at is null or now()<r.ends_at) and (r.scope_id=$2 or exists(select 1 from public.scopes s where s.id=$3 and s.parent_id=r.scope_id))`,
          [
            r.counselor_responsibility_id,
            options.department,
            found.rows[0].section_scope_id,
          ],
        );
        if (!counselor.rowCount)
          throw new Error(
            `Row ${i + 2}: responsibility is not a current counselor assignment in this department.`,
          );
        const dup = await db.query(
          'select 1 from public.counselor_student_mappings where roster_student_id=$1 and counselor_responsibility_id=$2 and starts_at=$3',
          [found.rows[0].id, r.counselor_responsibility_id, starts],
        );
        if (dup.rowCount)
          throw new Error(`Row ${i + 2}: counselor mapping already exists.`);
        roster.push({ ...r, roster_id: found.rows[0].id, starts_at: starts });
      }
    }
    console.log(
      `VALID: ${records.length} ${options.command === 'import-roster' ? 'roster' : 'counselor mapping'} row(s); all account/section/responsibility references validated.`,
    );
    for (const row of roster) {
      console.log(
        `PREVIEW ${JSON.stringify(
          options.command === 'import-roster'
            ? {
                studentIdentifier: row.student_identifier,
                displayName: row.display_name,
                sectionScopeId: row.section_scope_id,
                linkedProfile: Boolean(row.linked_student_id),
              }
            : {
                studentIdentifier: row.student_identifier,
                rosterId: row.roster_id,
                counselorResponsibilityId: row.counselor_responsibility_id,
                startsAt: row.starts_at,
              },
        )}`,
      );
    }
    if (!options.apply) {
      console.log(
        'PREVIEW ONLY. No records written. Add --apply to commit this validated transaction.',
      );
      return;
    }
    await db.query('begin');
    inTransaction = true;
    if (options.command === 'import-roster') {
      for (const r of roster) {
        const row = await db.query(
          `insert into public.department_student_roster(department_scope_id,external_student_id,display_name,section_scope_id,linked_student_id,created_by)
          values($1,$2,$3,$4,$5,$6) returning id`,
          [
            options.department,
            r.student_identifier,
            r.display_name,
            r.section_scope_id,
            r.linked_student_id,
            options.operator,
          ],
        );
        if (r.linked_student_id)
          await db.query(
            'insert into public.student_scope_memberships(student_id,scope_id) values($1,$2)',
            [r.linked_student_id, r.section_scope_id],
          );
        await db.query(
          "insert into public.department_directory_audit(actor_id,entity_type,entity_id,action,changes) values($1,'student_roster',$2,'imported',$3)",
          [
            options.operator,
            row.rows[0].id,
            {
              external_student_id: r.student_identifier,
              section_scope_id: r.section_scope_id,
              linked: !!r.linked_student_id,
            },
          ],
        );
      }
    } else
      for (const r of roster) {
        const row = await db.query(
          `insert into public.counselor_student_mappings(roster_student_id,counselor_responsibility_id,starts_at,created_by)
        values($1,$2,$3,$4) returning id`,
          [
            r.roster_id,
            r.counselor_responsibility_id,
            r.starts_at,
            options.operator,
          ],
        );
        await db.query(
          "insert into public.department_directory_audit(actor_id,entity_type,entity_id,action,changes) values($1,'counselor_mapping',$2,'imported',$3)",
          [
            options.operator,
            row.rows[0].id,
            {
              student_identifier: r.student_identifier,
              counselor_responsibility_id: r.counselor_responsibility_id,
              starts_at: r.starts_at,
            },
          ],
        );
      }
    await db.query('commit');
    inTransaction = false;
    console.log(
      `COMMITTED: ${records.length} records. No Auth users were created.`,
    );
  } finally {
    if (inTransaction) await db.query('rollback');
    await db.end();
  }
}

main().catch((error) => {
  console.error(`BLOCKED: ${error.message}`);
  process.exitCode = 1;
});
