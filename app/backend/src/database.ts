import { Pool, PoolClient } from 'pg';
import { config } from './config';

const pool = new Pool(
  config.db.url
    ? {
        connectionString: config.db.url,
        ssl: { rejectUnauthorized: false },
      }
    : {
        host: config.db.host,
        port: config.db.port,
        database: config.db.database,
        user: config.db.user,
        password: config.db.password,
        ssl: config.isProduction ? { rejectUnauthorized: false } : false,
      }
);

export default pool;

/** Run `fn` inside a BEGIN/COMMIT transaction, rolling back and rethrowing on error. */
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
