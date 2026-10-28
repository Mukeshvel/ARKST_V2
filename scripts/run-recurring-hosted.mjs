import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { runAuthorizedSchedules } from './lib/recurring-runner.mjs';

export function hostedRunnerConfig(env) {
  if (env.APP_ENV !== 'hosted' || env.ARKST_HOSTED_RUNNER_ENABLED !== 'true')
    throw new Error('Hosted recurring runner is not explicitly enabled.');
  let url;
  try {
    url = new URL(env.SUPABASE_URL);
  } catch {
    throw new Error('Hosted Supabase URL is invalid.');
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  )
    throw new Error('Hosted Supabase URL must be an HTTPS origin.');
  if (
    !env.SUPABASE_PUBLISHABLE_KEY ||
    !env.ARKST_SCHEDULER_EMAIL ||
    !env.ARKST_SCHEDULER_PASSWORD
  )
    throw new Error(
      'Restricted scheduler sign-in configuration is incomplete.',
    );
  return {
    url: url.origin,
    key: env.SUPABASE_PUBLISHABLE_KEY,
    email: env.ARKST_SCHEDULER_EMAIL,
    password: env.ARKST_SCHEDULER_PASSWORD,
  };
}

async function main() {
  const config = hostedRunnerConfig(process.env);
  const client = createClient(config.url, config.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(15000) }),
    },
  });
  let signedIn = false;
  try {
    const signIn = await client.auth.signInWithPassword({
      email: config.email,
      password: config.password,
    });
    if (signIn.error || !signIn.data.user)
      throw new Error('Restricted scheduler sign-in failed.');
    signedIn = true;
    // A short publication horizon gives staff time to record new exam blackouts.
    const result = await runAuthorizedSchedules(client, { horizonDays: 1 });
    console.log(
      `Hosted recurring runner: ${result.schedules} active schedules; ${result.published} published, ${result.blocked} blackout-blocked, ${result.existing} already recorded.`,
    );
  } finally {
    if (signedIn) {
      const signedOut = await client.auth.signOut({ scope: 'local' });
      if (signedOut.error) throw new Error('Scheduler session cleanup failed.');
    }
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
)
  main().catch((error) => {
    console.error(
      'Hosted recurring runner failed:',
      error?.code ?? error?.name ?? 'unavailable',
    );
    process.exitCode = 1;
  });
