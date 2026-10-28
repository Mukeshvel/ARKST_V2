import { localUrl } from '../../tests/integration/local-helpers.mjs';
import { hostedDatabaseConfig } from './hosted-db.mjs';

/** Only a trusted operator process may receive an owner database URL. */
export function operatorDatabaseConfig(env, options) {
  if (env.APP_ENV !== 'hosted') {
    if (!env.LOCAL_DATABASE_URL)
      throw new Error(
        'Set LOCAL_DATABASE_URL to the isolated local Supabase database.',
      );
    localUrl(
      env.LOCAL_DATABASE_URL,
      ['postgres:', 'postgresql:'],
      'LOCAL_DATABASE_URL',
      true,
    );
    return {
      connectionString: env.LOCAL_DATABASE_URL,
      connectionTimeoutMillis: 5000,
      query_timeout: 10000,
    };
  }
  if (
    env.ARKST_HOSTED_ADMIN_ENABLED !== 'true' ||
    !env.ADMIN_DATABASE_URL ||
    !options['database-host']
  )
    throw new Error(
      'Hosted operator access requires explicit enablement, ADMIN_DATABASE_URL and --database-host.',
    );
  return {
    ...hostedDatabaseConfig(env.ADMIN_DATABASE_URL, options['database-host']),
    query_timeout: 10000,
  };
}
