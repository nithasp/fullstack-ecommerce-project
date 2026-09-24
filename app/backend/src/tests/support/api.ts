import supertest from 'supertest';
import app from '../../app';
import { UserRepository } from '../../repositories/user.repository';
import { CURRENT_PASSWORD_VERSION, hashPassword } from '../../services/password.service';
import { Product } from '../../types/product.types';
import { TestAgent, TestBuyer, TestClient, TestUser } from '../../types/test.types';

export const API = '/api/v1';

export const api = supertest(app);

const users = new UserRepository();

export const uniqueName = (prefix: string): string =>
  `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

function clientFor(agent: TestAgent, token: () => string): TestClient {
  const withAuth = (test: supertest.Test) => test.set('Authorization', `Bearer ${token()}`);
  return {
    get: (url) => withAuth(agent.get(`${API}${url}`)),
    post: (url, body) => withAuth(agent.post(`${API}${url}`)).send(body ?? {}),
    patch: (url, body) => withAuth(agent.patch(`${API}${url}`)).send(body ?? {}),
    put: (url, body) => withAuth(agent.put(`${API}${url}`)).send(body ?? {}),
    delete: (url, body) => withAuth(agent.delete(`${API}${url}`)).send(body ?? {}),
  };
}

function testUser(id: number, username: string, password: string, token: string, agent: TestAgent): TestUser {
  let accessToken = token;
  const client = clientFor(agent, () => accessToken);
  return {
    id,
    username,
    password,
    agent,
    get token() {
      return accessToken;
    },
    set token(value: string) {
      accessToken = value;
    },
    ...client,
  };
}

export async function registerCustomer(prefix = 'customer'): Promise<TestUser> {
  const agent = supertest.agent(app);
  const username = uniqueName(prefix);
  const password = 'customerpass123';
  const res = await agent.post(`${API}/auth/register`).send({ username, password }).expect(201);
  return testUser(res.body.data.user.id, username, password, res.body.data.accessToken, agent);
}

export async function registerBuyer(prefix = 'buyer'): Promise<TestBuyer> {
  const customer = await registerCustomer(prefix);
  const res = await customer
    .post('/addresses', { fullName: 'Test Buyer', address: '1 Test Street', city: 'Testville' })
    .expect(201);
  return Object.assign(customer, { addressId: res.body.data.id as number });
}

export async function createAdmin(prefix = 'admin'): Promise<TestUser> {
  const username = uniqueName(prefix);
  const password = 'adminpass12345';
  const created = await users.create({
    firstName: 'Admin',
    lastName: 'User',
    username,
    role: 'admin',
    passwordHash: await hashPassword(password),
    passwordVersion: CURRENT_PASSWORD_VERSION,
  });

  const agent = supertest.agent(app);
  const res = await agent.post(`${API}/auth/login`).send({ username, password }).expect(200);
  return testUser(created.id, username, password, res.body.data.accessToken, agent);
}

export async function createProduct(
  admin: TestUser,
  overrides: Record<string, unknown> = {},
): Promise<Product> {
  const res = await admin
    .post('/admin/products', {
      name: uniqueName('Product'),
      price: 19.99,
      category: 'TestCategory',
      stock: 25,
      ...overrides,
    })
    .expect(201);
  return res.body.data as Product;
}

export function cookiesOf(res: supertest.Response): string[] {
  const header = res.headers['set-cookie'];
  return Array.isArray(header) ? header : header ? [String(header)] : [];
}

export function refreshCookie(res: supertest.Response): string | undefined {
  return cookiesOf(res).find((cookie) => cookie.startsWith('refreshToken='));
}

export function cookieValue(cookie: string): string {
  return cookie.split(';')[0]?.split('=')[1] ?? '';
}
