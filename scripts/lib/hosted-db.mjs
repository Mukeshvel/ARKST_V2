export function hostedDatabaseConfig(connection, expectedHost) {
  let url;
  try {
    url = new URL(connection);
  } catch {
    throw new Error('Hosted database URL is invalid.');
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !url.username ||
    !url.password ||
    !url.pathname ||
    url.pathname === '/' ||
    url.search ||
    url.hash ||
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !expectedHost ||
    url.hostname !== expectedHost
  )
    throw new Error(
      'Hosted database URL must use the approved exact remote host and TLS.',
    );
  return {
    connectionString: connection,
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 5000,
    query_timeout: 15000,
  };
}
