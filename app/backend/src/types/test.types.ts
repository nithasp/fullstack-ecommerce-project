import supertest from 'supertest';

export type TestRequest = ReturnType<typeof supertest>;

export interface TestAdmin {
  userId: number;
  username: string;
  password: string;
  token: string;
  refreshToken: string;
}

export interface TestCustomer {
  userId: number;
  username: string;
  password: string;
  token: string;
  refreshToken: string;
}

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

export interface AuditRow {
  action: string;
  event: string;
  username: string | null;
  userId: number | null;
  statusCode: number;
  path: string;
  details: Record<string, unknown> | null;
}
