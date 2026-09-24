// Migrations run before the app, with the widest privileges, so they resolve TLS on the same rule
// as src/config.ts instead of accepting any certificate the server offers (OWASP API8)
const sslMode = process.env.DATABASE_SSL || (process.env.DATABASE_URL ? 'verify' : 'off');
const sslCa = process.env.DATABASE_SSL_CA;

function ssl() {
  switch (sslMode) {
    case 'off':
      return false;
    case 'no-verify':
      return { rejectUnauthorized: false };
    case 'verify':
      return { rejectUnauthorized: true, ...(sslCa ? { ca: sslCa } : {}) };
    default:
      throw new Error(`[database] DATABASE_SSL must be off, no-verify or verify (got "${sslMode}")`);
  }
}

module.exports = {
  dev: {
    driver: 'pg',
    host: { ENV: 'POSTGRES_HOST' },
    port: { ENV: 'POSTGRES_PORT' },
    database: { ENV: 'POSTGRES_DB' },
    user: { ENV: 'POSTGRES_USER' },
    password: { ENV: 'POSTGRES_PASSWORD' },
    ssl: ssl(),
  },
  production: {
    driver: 'pg',
    url: { ENV: 'DATABASE_URL' },
    ssl: ssl(),
  },
  test: {
    driver: 'pg',
    host: { ENV: 'POSTGRES_HOST' },
    port: { ENV: 'POSTGRES_PORT' },
    database: { ENV: 'POSTGRES_TEST_DB' },
    user: { ENV: 'POSTGRES_USER' },
    password: { ENV: 'POSTGRES_PASSWORD' },
    ssl: ssl(),
  },
};
