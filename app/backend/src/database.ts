import dotenv from 'dotenv';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

dotenv.config();

const { DATABASE_URL, POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_TEST_DB, POSTGRES_USER, POSTGRES_PASSWORD, ENV } = process.env;

const isProduction = ENV === 'production';

const pool = new Pool(
  DATABASE_URL
    ? {
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      }
    : {
        host: POSTGRES_HOST,
        port: parseInt(POSTGRES_PORT as string),
        database: ENV === 'test' ? POSTGRES_TEST_DB : POSTGRES_DB,
        user: POSTGRES_USER,
        password: POSTGRES_PASSWORD,
        ssl: isProduction ? { rejectUnauthorized: false } : false,
      }
);

// Anything that can run a query: the pool, or a client checked out for a transaction.
// Repository methods that take one can be composed by a service into a single transaction.
export interface Queryable {
  query<R extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<R>>;
}

// Runs fn on one pooled client between BEGIN and COMMIT, rolling back if it throws
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
