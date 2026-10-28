import { createWebPushSender, dispatchDue } from './lib/push-dispatch.mjs';
import { hostedDatabaseConfig } from './lib/hosted-db.mjs';

async function main() {
  if (
    process.env.APP_ENV !== 'hosted' ||
    process.env.PUSH_DISPATCH_ENABLED !== 'true'
  )
    throw new Error('Hosted push dispatcher is not explicitly enabled.');
  const databaseUrl = process.env.PUSH_DATABASE_URL;
  const database = hostedDatabaseConfig(
    databaseUrl,
    process.env.PUSH_DATABASE_HOST,
  );
  const send = createWebPushSender({
    publicKey: process.env.PUSH_VAPID_PUBLIC_KEY,
    privateKey: process.env.PUSH_VAPID_PRIVATE_KEY,
    subject: process.env.PUSH_VAPID_SUBJECT,
  });
  const result = await dispatchDue({
    databaseUrl,
    connectionOptions: { ssl: database.ssl },
    send,
  });
  console.log(
    `Push dispatch: ${result.claimed} jobs claimed, ${result.attempts} provider attempts, ${result.expired} expired.`,
  );
}

main().catch((error) => {
  // Do not log endpoints, encryption keys, provider response bodies or DB URLs.
  console.error(
    'Push dispatch failed:',
    error?.code ?? error?.name ?? 'unavailable',
  );
  process.exitCode = 1;
});
