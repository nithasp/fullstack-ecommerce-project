import { Pool, PoolClient } from 'pg';
import { config } from './config';
import { logger } from './logger';

const { url, host, port, name, user, password, sslMode, sslCa } = config.database;

// 'no-verify' accepts any certificate the server offers, which a provider with a self-signed
// certificate needs; it does not protect against a machine in the middle (OWASP API8)
const ssl =
  sslMode === 'off'
    ? false
    : sslMode === 'no-verify'
      ? { rejectUnauthorized: false }
      : { rejectUnauthorized: true, ...(sslCa ? { ca: sslCa } : {}) };

const pool = new Pool(
  url ? { connectionString: url, ssl } : { host, port, database: name, user, password, ssl },
);

pool.on('error', (err) => logger.error({ err }, 'idle database client error'));

export async function withTransaction<T>(fn: (tx: PoolClient) => Promise<T>): Promise<T> {
  const tx = await pool.connect();
  try {
    await tx.query('BEGIN');
    const result = await fn(tx);
    await tx.query('COMMIT');
    return result;
  } catch (err) {
    await tx.query('ROLLBACK');
    throw err;
  } finally {
    tx.release();
  }
}

export default pool;
