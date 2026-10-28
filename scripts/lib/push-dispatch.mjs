import pg from 'pg';
import webpush from 'web-push';
import { randomUUID } from 'node:crypto';

const LEASE_SECONDS = 180;
const MAX_DELIVERY_ATTEMPTS = 6;
const MAX_DEVICES_PER_PASS = 8;
const MAX_JOBS_PER_RUN = 20;

export function allowedPushEndpoint(value) {
  if (typeof value !== 'string' || value.length < 20 || value.length > 2048)
    return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.hash &&
      (url.port === '' || url.port === '443') &&
      url.pathname.length > 1 &&
      (host === 'fcm.googleapis.com' ||
        host === 'updates.push.services.mozilla.com' ||
        host === 'web.push.apple.com' ||
        host === 'wns.notify.windows.com' ||
        host.endsWith('.notify.windows.com'))
    );
  } catch {
    return false;
  }
}

export function retryDelaySeconds(attempt) {
  return Math.min(3600, 30 * 2 ** Math.max(0, attempt - 1));
}

export function classifyPushFailure(error) {
  const status = Number(error?.statusCode);
  if (status === 404 || status === 410)
    return { terminal: true, disable: true, errorClass: 'gone', status };
  if (status === 429)
    return {
      terminal: false,
      disable: false,
      errorClass: 'rate_limit',
      status,
    };
  if (status >= 500 && status <= 599)
    return {
      terminal: false,
      disable: false,
      errorClass: 'provider_unavailable',
      status,
    };
  if (status >= 400 && status <= 499)
    return { terminal: true, disable: false, errorClass: 'rejected', status };
  return {
    terminal: false,
    disable: false,
    errorClass: 'network',
    status: null,
  };
}

export function createWebPushSender({ publicKey, privateKey, subject }) {
  if (
    !/^[A-Za-z0-9_-]{60,120}$/.test(publicKey ?? '') ||
    !/^[A-Za-z0-9_-]{30,80}$/.test(privateKey ?? '') ||
    !/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(subject ?? '')
  )
    throw new Error('VAPID configuration is incomplete.');
  return async (subscription, notificationId) => {
    if (!allowedPushEndpoint(subscription.endpoint))
      throw Object.assign(new Error('Invalid endpoint'), {
        invalidEndpoint: true,
      });
    // The payload contains only an opaque inbox ID. The worker fetches private
    // content with the recipient's current authenticated session before display.
    return webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth_secret,
        },
      },
      JSON.stringify({ notificationId }),
      {
        vapidDetails: { subject, publicKey, privateKey },
        TTL: 86400,
        timeout: 10000,
        urgency: 'normal',
      },
    );
  };
}

export async function claimNext(client, outboxIds = null) {
  const token = randomUUID();
  const { rows } = await client.query(
    `
    update public.notification_outbox o
      set claim_token=$1,lease_until=now()+($2::integer * interval '1 second'),
          attempt_count=attempt_count+1
    where o.id=(select id from public.notification_outbox
      where processed_at is null and next_attempt_at<=now()
        and ($3::bigint[] is null or id=any($3::bigint[]))
        and (lease_until is null or lease_until<now())
      order by next_attempt_at,id for update skip locked limit 1)
    returning o.id,o.notification_id,o.claim_token,o.expires_at,o.recipients_snapshotted_at
  `,
    [token, LEASE_SECONDS, outboxIds],
  );
  return rows[0] ?? null;
}

async function prepareDeliveries(client, job) {
  if (!job.recipients_snapshotted_at) {
    await client.query(
      `
      insert into public.push_deliveries(outbox_id,subscription_id)
      select $1,s.id from public.notifications n
      join public.push_subscriptions s on s.user_id=n.recipient_id
        and s.active and (s.expires_at is null or s.expires_at>now())
      where n.id=$2
      on conflict(outbox_id,subscription_id) do nothing
    `,
      [job.id, job.notification_id],
    );
    await client.query(
      `
      update public.notification_outbox set recipients_snapshotted_at=now()
      where id=$1 and claim_token=$2
    `,
      [job.id, job.claim_token],
    );
  }
}

async function completeJob(client, job) {
  const {
    rows: [summary],
  } = await client.query(
    `
    select count(*)::integer total,
      count(*) filter(where state='pending')::integer pending,
      count(*) filter(where state='accepted')::integer accepted,
      min(next_attempt_at) filter(where state='pending') next_due
    from public.push_deliveries where outbox_id=$1
  `,
    [job.id],
  );
  if (summary.pending === 0) {
    const outcome =
      summary.total === 0
        ? 'no_subscriptions'
        : summary.accepted > 0
          ? 'accepted'
          : 'failed';
    await client.query(
      `update public.notification_outbox
      set processed_at=now(),outcome=$3,claim_token=null,lease_until=null
      where id=$1 and claim_token=$2`,
      [job.id, job.claim_token, outcome],
    );
  } else {
    await client.query(
      `update public.notification_outbox
      set next_attempt_at=$3,claim_token=null,lease_until=null
      where id=$1 and claim_token=$2`,
      [job.id, job.claim_token, summary.next_due],
    );
  }
}

export async function processClaim(client, job, send) {
  if (new Date(job.expires_at).getTime() <= Date.now()) {
    await client.query(
      `update public.push_deliveries set state='expired',updated_at=now()
      where outbox_id=$1 and state='pending'`,
      [job.id],
    );
    await client.query(
      `update public.notification_outbox
      set processed_at=now(),outcome='expired',claim_token=null,lease_until=null
      where id=$1 and claim_token=$2`,
      [job.id, job.claim_token],
    );
    return { expired: true, attempts: 0 };
  }
  await prepareDeliveries(client, job);
  const { rows } = await client.query(
    `
    select d.id,d.attempt_count,s.id subscription_id,s.endpoint,s.p256dh,s.auth_secret,s.active,
      s.expires_at from public.push_deliveries d
      join public.push_subscriptions s on s.id=d.subscription_id
      where d.outbox_id=$1 and d.state='pending' and d.next_attempt_at<=now()
      order by d.id limit $2
  `,
    [job.id, MAX_DEVICES_PER_PASS],
  );
  let attempts = 0;
  for (const row of rows) {
    const invalid = !allowedPushEndpoint(row.endpoint);
    const disabled =
      !row.active || (row.expires_at && new Date(row.expires_at) <= new Date());
    if (invalid || disabled) {
      await client.query(
        `update public.push_deliveries
        set state='permanent',last_error_class=$2,updated_at=now() where id=$1`,
        [row.id, invalid ? 'invalid_endpoint' : 'disabled'],
      );
      if (invalid || row.expires_at)
        await client.query(
          `update public.push_subscriptions
        set active=false,disabled_at=coalesce(disabled_at,now()),updated_at=now() where id=$1`,
          [row.subscription_id],
        );
      continue;
    }
    attempts++;
    try {
      const response = await send(row, job.notification_id);
      await client.query(
        `update public.push_deliveries set state='accepted',
        attempt_count=attempt_count+1,last_status=$2,last_error_class=null,
        accepted_at=now(),updated_at=now() where id=$1`,
        [
          row.id,
          Number.isInteger(response?.statusCode) ? response.statusCode : null,
        ],
      );
    } catch (error) {
      const failure = error?.invalidEndpoint
        ? {
            terminal: true,
            disable: true,
            errorClass: 'invalid_endpoint',
            status: null,
          }
        : classifyPushFailure(error);
      const terminal =
        failure.terminal ||
        row.attempt_count + 1 >= MAX_DELIVERY_ATTEMPTS ||
        Date.now() + retryDelaySeconds(row.attempt_count + 1) * 1000 >=
          new Date(job.expires_at).getTime();
      await client.query(
        `update public.push_deliveries
        set state=$2,attempt_count=attempt_count+1,last_status=$3,last_error_class=$4,
          next_attempt_at=now()+($5::integer * interval '1 second'),updated_at=now()
        where id=$1`,
        [
          row.id,
          terminal ? 'permanent' : 'pending',
          failure.status,
          terminal && !failure.terminal
            ? 'retry_exhausted'
            : failure.errorClass,
          retryDelaySeconds(row.attempt_count + 1),
        ],
      );
      if (failure.disable)
        await client.query(
          `update public.push_subscriptions
        set active=false,disabled_at=coalesce(disabled_at,now()),updated_at=now() where id=$1`,
          [row.subscription_id],
        );
    }
  }
  await completeJob(client, job);
  return { expired: false, attempts };
}

export async function dispatchDue({
  databaseUrl,
  send,
  limit = MAX_JOBS_PER_RUN,
  outboxIds = null,
}) {
  if (typeof databaseUrl !== 'string' || !databaseUrl)
    throw new Error('Push database connection is missing.');
  if (typeof send !== 'function') throw new Error('Push sender is missing.');
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_JOBS_PER_RUN)
    throw new Error('Invalid dispatch batch limit.');
  if (
    outboxIds !== null &&
    (!Array.isArray(outboxIds) ||
      outboxIds.some((id) => !/^\d+$/.test(String(id))))
  )
    throw new Error('Invalid isolated outbox IDs.');
  const client = new pg.Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
    query_timeout: 15000,
  });
  await client.connect();
  let claimed = 0,
    attempts = 0,
    expired = 0;
  try {
    await client.query(`update public.push_subscriptions
      set active=false,disabled_at=coalesce(disabled_at,now()),updated_at=now()
      where active and expires_at is not null and expires_at<=now()`);
    for (; claimed < limit;) {
      const job = await claimNext(client, outboxIds);
      if (!job) break;
      claimed++;
      const result = await processClaim(client, job, send);
      attempts += result.attempts;
      expired += Number(result.expired);
    }
  } finally {
    await client.end();
  }
  return { claimed, attempts, expired };
}
