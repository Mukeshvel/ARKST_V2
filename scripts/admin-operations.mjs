// Trusted operator: preview by default; --apply rechecks and commits once.
import pg from 'pg';
import { operatorDatabaseConfig } from './lib/operator-db.mjs';

const uuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value ?? '',
  );
function argumentsFrom(argv) {
  const [command, ...rest] = argv;
  if (
    ![
      'grant-activity',
      'assign-responsibility',
      'end-responsibility',
      'set-route',
    ].includes(command)
  )
    throw new Error(
      'Use grant-activity, assign-responsibility, end-responsibility or set-route.',
    );
  const options = { command, apply: false };
  for (let i = 0; i < rest.length; i++) {
    const key = rest[i];
    if (key === '--apply') {
      options.apply = true;
      continue;
    }
    if (
      !key.startsWith('--') ||
      !rest[i + 1] ||
      Object.hasOwn(options, key.slice(2))
    )
      throw new Error('Invalid or repeated operator argument.');
    options[key.slice(2)] = rest[++i];
  }
  if (!uuid(options.operator) || !uuid(options.department))
    throw new Error('Exact --operator and --department UUIDs are required.');
  return options;
}
async function admin(db, options, lock = false) {
  const result = await db.query(
    `select r.id from public.profiles p join public.responsibility_assignments r on r.user_id=p.id
    join public.scopes s on s.id=r.scope_id and s.kind='department'
    where p.id=$1 and p.is_active and p.account_kind='staff' and r.role='admin' and s.id=$2
      and r.starts_at<=now() and (r.ends_at is null or now()<r.ends_at) ${lock ? 'for share of r' : ''}`,
    [options.operator, options.department],
  );
  if (!result.rowCount)
    throw new Error(
      'Current exact-department administrator approval is required.',
    );
}
async function currentResponsibility(db, id, department, lock = false) {
  const result = await db.query(
    `select r.id,r.user_id,r.role,r.scope_id from public.responsibility_assignments r
    join public.profiles p on p.id=r.user_id and p.account_kind='staff' and p.is_active
    join public.scopes s on s.id=r.scope_id
    where r.id=$1 and r.starts_at<=now() and (r.ends_at is null or now()<r.ends_at)
      and (s.id=$2 and s.kind='department' or s.kind='section' and s.parent_id=$2)
      ${lock ? 'for update of r' : ''}`,
    [id, department],
  );
  if (result.rowCount !== 1)
    throw new Error('Target responsibility is not current in this department.');
  return result.rows[0];
}
async function history(db, options, operation, entityId, before, after) {
  await db.query(
    `insert into public.trusted_operator_history(actor_id,operation,entity_id,before_value,after_value)
    values($1,$2,$3,$4,$5)`,
    [options.operator, operation, entityId, before, after],
  );
}
async function execute(db, options) {
  await admin(db, options);
  if (options.command === 'grant-activity') {
    if (
      !uuid(options.responsibility) ||
      !/^[a-z][a-z0-9_]{0,49}$/.test(options.category ?? '') ||
      !['true', 'false'].includes(options.create) ||
      !['true', 'false'].includes(options.verify)
    )
      throw new Error(
        'grant-activity requires responsibility, category, and explicit create/verify true|false.',
      );
    await currentResponsibility(db, options.responsibility, options.department);
    const category = await db.query(
      'select 1 from public.activity_categories where key=$1',
      [options.category],
    );
    if (!category.rowCount) throw new Error('Unknown Activity category.');
    const expected = {
      create: options.create === 'true',
      verify: options.verify === 'true',
    };
    const previous = await db.query(
      'select can_create,can_verify from public.activity_capabilities where responsibility_id=$1 and category_key=$2',
      [options.responsibility, options.category],
    );
    const before = {
      create: previous.rows[0]?.can_create ?? false,
      verify: previous.rows[0]?.can_verify ?? false,
    };
    if (JSON.stringify(before) === JSON.stringify(expected))
      throw new Error('Activity grant is unchanged.');
    console.log(
      `PREVIEW ${JSON.stringify({ responsibility: options.responsibility, category: options.category, before, after: expected })}`,
    );
    if (!options.apply) return;
    await admin(db, options, true);
    await currentResponsibility(
      db,
      options.responsibility,
      options.department,
      true,
    );
    const again = await db.query(
      'select can_create,can_verify from public.activity_capabilities where responsibility_id=$1 and category_key=$2 for update',
      [options.responsibility, options.category],
    );
    if (
      (again.rows[0]?.can_create ?? false) !== before.create ||
      (again.rows[0]?.can_verify ?? false) !== before.verify
    )
      throw new Error('Activity grant changed since preview; review again.');
    if (expected.create || expected.verify)
      await db.query(
        `insert into public.activity_capabilities(responsibility_id,category_key,can_create,can_verify)
        values($1,$2,$3,$4) on conflict(responsibility_id,category_key) do update set
        can_create=excluded.can_create,can_verify=excluded.can_verify`,
        [
          options.responsibility,
          options.category,
          expected.create,
          expected.verify,
        ],
      );
    else
      await db.query(
        'delete from public.activity_capabilities where responsibility_id=$1 and category_key=$2',
        [options.responsibility, options.category],
      );
    await history(
      db,
      options,
      'activity_grant',
      options.responsibility,
      { category: options.category, ...before },
      { category: options.category, ...expected },
    );
    return;
  }
  if (options.command === 'assign-responsibility') {
    if (
      !uuid(options.user) ||
      !uuid(options.scope) ||
      ![
        'teacher',
        'counselor',
        'coordinator',
        'placement_coordinator',
        'branch_coordinator',
      ].includes(options.role)
    )
      throw new Error(
        'assign-responsibility accepts only an existing staff UUID, approved ordinary role and department/child section scope.',
      );
    const scope = await db.query(
      `select 1 from public.scopes where id=$1 and
      (id=$2 and kind='department' or parent_id=$2 and kind='section')`,
      [options.scope, options.department],
    );
    const person = await db.query(
      "select 1 from public.profiles where id=$1 and account_kind='staff' and is_active",
      [options.user],
    );
    if (!scope.rowCount || !person.rowCount)
      throw new Error(
        'Approved staff and exact department/section scope are required.',
      );
    const present = await db.query(
      `select 1 from public.responsibility_assignments where user_id=$1 and role=$2 and scope_id=$3
      and starts_at<=now() and (ends_at is null or now()<ends_at)`,
      [options.user, options.role, options.scope],
    );
    if (present.rowCount)
      throw new Error('This responsibility is already current.');
    console.log(
      `PREVIEW ${JSON.stringify({ user: options.user, role: options.role, scope: options.scope })}`,
    );
    if (!options.apply) return;
    await admin(db, options, true);
    const locked = await db.query(
      "select id from public.profiles where id=$1 and account_kind='staff' and is_active for update",
      [options.user],
    );
    if (!locked.rowCount)
      throw new Error('Staff approval changed since preview.');
    const again = await db.query(
      `select 1 from public.responsibility_assignments where user_id=$1 and role=$2 and scope_id=$3
      and starts_at<=now() and (ends_at is null or now()<ends_at)`,
      [options.user, options.role, options.scope],
    );
    if (again.rowCount)
      throw new Error('Responsibility changed since preview.');
    const added = await db.query(
      'insert into public.responsibility_assignments(user_id,role,scope_id) values($1,$2,$3) returning id',
      [options.user, options.role, options.scope],
    );
    await history(
      db,
      options,
      'responsibility_add',
      added.rows[0].id,
      {},
      { user: options.user, role: options.role, scope: options.scope },
    );
    return;
  }
  if (options.command === 'end-responsibility') {
    if (!uuid(options.responsibility))
      throw new Error('end-responsibility requires a responsibility UUID.');
    const target = await currentResponsibility(
      db,
      options.responsibility,
      options.department,
    );
    if (['hod', 'admin'].includes(target.role))
      throw new Error(
        'HOD/Admin changes require a separately approved process.',
      );
    const used = await db.query(
      `select
      (select count(*)::int from public.counselor_student_mappings where counselor_responsibility_id=$1
        and starts_at<=now() and (ends_at is null or now()<ends_at)) counselors,
      (select count(*)::int from public.escalation_routes where responsibility_id=$1 and active) routes,
      (select count(*)::int from public.activity_escalations where recipient_responsibility_id=$1 and status='open') cases`,
      [target.id],
    );
    if (Object.values(used.rows[0]).some((x) => x > 0))
      throw new Error(
        'Current counselor mappings, routes or open cases must be reassigned/resolved before ending.',
      );
    console.log(
      `PREVIEW ${JSON.stringify({ responsibility: target.id, user: target.user_id, role: target.role, scope: target.scope_id, action: 'end' })}`,
    );
    if (!options.apply) return;
    await admin(db, options, true);
    await currentResponsibility(db, target.id, options.department, true);
    const stillUsed = await db.query(
      `select exists(select 1 from public.counselor_student_mappings where counselor_responsibility_id=$1 and starts_at<=now() and (ends_at is null or now()<ends_at)) or
      exists(select 1 from public.escalation_routes where responsibility_id=$1 and active) or
      exists(select 1 from public.activity_escalations where recipient_responsibility_id=$1 and status='open') blocked`,
      [target.id],
    );
    if (stillUsed.rows[0].blocked)
      throw new Error('Dependent current access changed since preview.');
    await db.query(
      'update public.responsibility_assignments set ends_at=transaction_timestamp() where id=$1',
      [target.id],
    );
    await history(
      db,
      options,
      'responsibility_end',
      target.id,
      { user: target.user_id, role: target.role, scope: target.scope_id },
      {},
    );
    return;
  }
  if (
    !uuid(options.section) ||
    !['coordinator', 'branch_coordinator', 'hod'].includes(options.role) ||
    !(uuid(options.responsibility) || options.responsibility === 'none')
  )
    throw new Error(
      'set-route requires an exact child section, coordinator/branch_coordinator/hod and responsibility UUID or none.',
    );
  const section = await db.query(
    "select id from public.scopes where id=$1 and kind='section' and parent_id=$2",
    [options.section, options.department],
  );
  if (!section.rowCount)
    throw new Error('Route section is outside the approved department.');
  if (options.responsibility !== 'none') {
    const target = await currentResponsibility(
      db,
      options.responsibility,
      options.department,
    );
    if (
      target.role !== options.role ||
      ![options.department, options.section].includes(target.scope_id)
    )
      throw new Error(
        'Route must target a current matching role for this section or department.',
      );
  }
  const existing = await db.query(
    'select id,responsibility_id from public.escalation_routes where section_scope_id=$1 and target_role=$2 and active',
    [options.section, options.role],
  );
  if (existing.rowCount > 1)
    throw new Error('Conflicting current routes require operator review.');
  if (
    (existing.rows[0]?.responsibility_id ?? 'none') === options.responsibility
  )
    throw new Error('Route is unchanged.');
  const open = await db.query(
    `select count(*)::int n from public.activity_escalations e
    join public.activity_assignments x on x.id=e.assignment_id
    join public.department_student_roster r on r.linked_student_id=x.student_id
    where r.section_scope_id=$1 and r.department_scope_id=$2 and e.stage=$3 and e.status='open'`,
    [options.section, options.department, options.role],
  );
  if (open.rows[0].n)
    throw new Error(
      'Open cases in this section/stage must be resolved before route changes.',
    );
  console.log(
    `PREVIEW ${JSON.stringify({ section: options.section, role: options.role, previous: existing.rows[0]?.responsibility_id ?? null, next: options.responsibility === 'none' ? null : options.responsibility })}`,
  );
  if (!options.apply) return;
  await admin(db, options, true);
  await db.query(
    "select id from public.scopes where id=$1 and kind='section' and parent_id=$2 for update",
    [options.section, options.department],
  );
  const again = await db.query(
    'select id,responsibility_id from public.escalation_routes where section_scope_id=$1 and target_role=$2 and active for update',
    [options.section, options.role],
  );
  if ((again.rows[0]?.id ?? null) !== (existing.rows[0]?.id ?? null))
    throw new Error('Route changed since preview.');
  if (options.responsibility !== 'none') {
    const target = await currentResponsibility(
      db,
      options.responsibility,
      options.department,
      true,
    );
    if (
      target.role !== options.role ||
      ![options.department, options.section].includes(target.scope_id)
    )
      throw new Error('Route target changed since preview.');
  }
  const openAgain = await db.query(
    `select count(*)::int n from public.activity_escalations e
    join public.activity_assignments x on x.id=e.assignment_id
    join public.department_student_roster r on r.linked_student_id=x.student_id
    where r.section_scope_id=$1 and r.department_scope_id=$2 and e.stage=$3 and e.status='open'`,
    [options.section, options.department, options.role],
  );
  if (openAgain.rows[0].n)
    throw new Error('Open cases appeared since preview.');
  if (existing.rowCount)
    await db.query(
      'update public.escalation_routes set active=false where id=$1',
      [existing.rows[0].id],
    );
  let newId = null;
  if (options.responsibility !== 'none') {
    const added = await db.query(
      `insert into public.escalation_routes(section_scope_id,target_role,responsibility_id)
      values($1,$2,$3) returning id`,
      [options.section, options.role, options.responsibility],
    );
    newId = added.rows[0].id;
  }
  await history(
    db,
    options,
    'escalation_route',
    newId ?? existing.rows[0].id,
    {
      section: options.section,
      role: options.role,
      responsibility: existing.rows[0]?.responsibility_id ?? null,
    },
    {
      section: options.section,
      role: options.role,
      responsibility:
        options.responsibility === 'none' ? null : options.responsibility,
    },
  );
}

async function main() {
  const options = argumentsFrom(process.argv.slice(2));
  const db = new pg.Client(operatorDatabaseConfig(process.env, options));
  await db.connect();
  let transaction = false;
  try {
    if (options.apply) {
      await db.query('begin');
      transaction = true;
    }
    await execute(db, options);
    if (transaction) {
      await db.query('commit');
      transaction = false;
      console.log('COMMITTED: trusted operation changed and audited.');
    } else
      console.log('PREVIEW ONLY. No records written. Add --apply to commit.');
  } finally {
    if (transaction) await db.query('rollback');
    await db.end();
  }
}
main().catch((error) => {
  console.error(`BLOCKED: ${error.message}`);
  process.exitCode = 1;
});
