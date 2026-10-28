import { open } from 'node:fs/promises';
import webpush from 'web-push';

const path = '.env.push.local';
const keys = webpush.generateVAPIDKeys();
const contents = [
  `PUSH_VAPID_PUBLIC_KEY=${keys.publicKey}`,
  `PUSH_VAPID_PRIVATE_KEY=${keys.privateKey}`,
  'PUSH_VAPID_SUBJECT=mailto:arkst-local@example.test',
  '',
].join('\n');
try {
  const file = await open(path, 'wx', 0o600);
  try {
    await file.writeFile(contents);
  } finally {
    await file.close();
  }
  console.log(
    'Generated ignored .env.push.local. Keep this keypair stable for existing subscriptions.',
  );
  console.log(
    'Copy only PUSH_VAPID_PUBLIC_KEY into the app server environment.',
  );
} catch (error) {
  if (error?.code === 'EEXIST') {
    console.error(
      '.env.push.local already exists; key rotation was not performed.',
    );
    process.exitCode = 1;
  } else throw error;
}
