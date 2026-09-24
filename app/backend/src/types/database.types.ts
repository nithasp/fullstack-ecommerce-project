import { PoolClient, QueryResult, QueryResultRow } from 'pg';

export type Tx = PoolClient;

export interface Queryable {
  query<R extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<R>>;
}

export interface PostgresError {
  code?: string | undefined;
  constraint?: string | undefined;
  detail?: string | undefined;
}
