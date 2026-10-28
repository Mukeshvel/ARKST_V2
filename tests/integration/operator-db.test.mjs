import { test } from 'node:test';
import assert from 'node:assert/strict';
import { operatorDatabaseConfig } from '../../scripts/lib/operator-db.mjs';
import { hostedDatabaseConfig } from '../../scripts/lib/hosted-db.mjs';

test('operator connection defaults to loopback and rejects remote without explicit hosted mode', () => {
  assert.equal(
    operatorDatabaseConfig(
      {
        LOCAL_DATABASE_URL:
          'postgresql://operator:synthetic@127.0.0.1:54322/postgres',
      },
      {},
    ).ssl,
    undefined,
  );
  assert.throws(() =>
    operatorDatabaseConfig(
      {
        LOCAL_DATABASE_URL:
          'postgresql://operator:synthetic@db.example.edu/postgres',
      },
      {},
    ),
  );
});
test('hosted push database URL requires exact host and rejects SSL override parameters', () => {
  assert.deepEqual(
    hostedDatabaseConfig(
      'postgresql://operator:synthetic@db.example.edu/postgres',
      'db.example.edu',
    ).ssl,
    { rejectUnauthorized: true },
  );
  assert.throws(() =>
    hostedDatabaseConfig(
      'postgresql://operator:synthetic@db.example.edu/postgres?sslmode=disable',
      'db.example.edu',
    ),
  );
  assert.throws(() =>
    hostedDatabaseConfig(
      'postgresql://operator:synthetic@db.other.edu/postgres',
      'db.example.edu',
    ),
  );
});
test('hosted operator requires explicit mode, exact host and verified TLS', () => {
  const env = {
    APP_ENV: 'hosted',
    ARKST_HOSTED_ADMIN_ENABLED: 'true',
    ADMIN_DATABASE_URL:
      'postgresql://operator:synthetic@db.example.edu/postgres',
  };
  const config = operatorDatabaseConfig(env, {
    'database-host': 'db.example.edu',
  });
  assert.deepEqual(config.ssl, { rejectUnauthorized: true });
  for (const [change, options] of [
    [
      { ARKST_HOSTED_ADMIN_ENABLED: 'false' },
      { 'database-host': 'db.example.edu' },
    ],
    [{}, { 'database-host': 'other.example.edu' }],
    [
      {
        ADMIN_DATABASE_URL:
          'postgresql://operator:synthetic@127.0.0.1/postgres',
      },
      { 'database-host': '127.0.0.1' },
    ],
    [
      {
        ADMIN_DATABASE_URL:
          'postgresql://operator:synthetic@db.example.edu/postgres?sslmode=disable',
      },
      { 'database-host': 'db.example.edu' },
    ],
  ])
    assert.throws(() => operatorDatabaseConfig({ ...env, ...change }, options));
});
