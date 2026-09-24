import supertest from 'supertest';

export type TestAgent = ReturnType<typeof supertest.agent>;

export interface TestClient {
  get(url: string): supertest.Test;
  post(url: string, body?: unknown): supertest.Test;
  patch(url: string, body?: unknown): supertest.Test;
  put(url: string, body?: unknown): supertest.Test;
  delete(url: string, body?: unknown): supertest.Test;
}

export interface TestUser extends TestClient {
  id: number;
  username: string;
  password: string;
  token: string;
  agent: TestAgent;
}

export interface TestBuyer extends TestUser {
  addressId: number;
}

export interface ErrorEnvelope {
  status: number;
  message: string;
  data: null;
  code?: string | undefined;
}

export interface CapturedError {
  statusCode: number;
  body: ErrorEnvelope;
  logged: boolean;
}

export interface PostgresErrorFields {
  code: string;
  constraint?: string | undefined;
  detail?: string | undefined;
}

export interface AuditRow {
  action: string;
  event: string;
  username: string | null;
  userId: number | null;
  statusCode: number;
  path: string;
  details: Record<string, unknown> | null;
}
