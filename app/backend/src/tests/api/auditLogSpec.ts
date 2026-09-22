import supertest from 'supertest';
import app from '../../app';
import pool from '../../database';
import { config } from '../../config';
import { createAdmin } from '../support/admin';
import { flushAuditLog, purgeExpiredAuditLogs } from '../../services/audit.service';
import { AuditLog } from '../../types/auditLog.types';
import { TestAdmin, TestCustomer } from '../../types/test.types';

const request = supertest(app);

const registerCustomer = async (prefix: string): Promise<TestCustomer> => {
  const username = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const password = 'customerpass123';
  const res = await request
    .post('/api/v1/auth/register')
    .send({ username, password, firstName: 'Cust', lastName: 'Omer' })
    .expect(201);
  return { userId: res.body.data.user.id, token: res.body.data.accessToken, refreshToken: res.body.data.refreshToken, username, password };
};

describe('Audit Log', () => {
  let admin: TestAdmin;
  let alice: TestCustomer;
  let productId: number;

  const readLog = async (query: Record<string, string | number>): Promise<{ rows: AuditLog[]; total: number }> => {
    await flushAuditLog();
    const res = await request
      .get('/api/v1/admin/audit-logs')
      .query({ limit: 100, ...query })
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    return { rows: res.body.data, total: res.body.meta.total };
  };

  const logsFor = async (userId: number): Promise<AuditLog[]> => (await readLog({ userId })).rows;

  const latest = async (userId: number, event: string): Promise<AuditLog> => {
    const row = (await logsFor(userId)).find((r) => r.event === event);
    if (!row) throw new Error(`no ${event} entry for user ${userId}`);
    return row;
  };

  beforeAll(async () => {
    admin = await createAdmin(request, 'auditadmin');
    alice = await registerCustomer('auditalice');

    const product = await request
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Audit Spec Product', price: 5, category: 'AuditSpec', stock: 20 })
      .expect(201);
    productId = product.body.data.id;
  });

  describe('GET /admin/audit-logs', () => {
    it('should reject requests without a token', async () => {
      const res = await request.get('/api/v1/admin/audit-logs').expect(401);
      expect(res.body.code).toBe('no_token');
    });

    it('should return 403 for a customer token', async () => {
      const res = await request
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(403);
      expect(res.body.message).toBe('Admin access required');
    });

    it('should return a page of entries with meta for an admin', async () => {
      await flushAuditLog();
      const res = await request
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);
      expect(Array.isArray(res.body.data)).toBeTrue();
      expect(res.body.meta).toEqual(jasmine.objectContaining({ limit: 50, offset: 0 }));
      expect(res.body.meta.total).toBeGreaterThan(0);
    });

    it('should offer no way to change or delete an entry, and record the attempt', async () => {
      await request.put('/api/v1/admin/audit-logs/1').set('Authorization', `Bearer ${admin.token}`).expect(404);
      await request.delete('/api/v1/admin/audit-logs/1').set('Authorization', `Bearer ${admin.token}`).expect(404);

      const attempt = (await logsFor(admin.userId)).find((r) => r.method === 'DELETE' && r.path === '/api/v1/admin/audit-logs/1');
      expect(attempt).toEqual(jasmine.objectContaining({ action: 'DELETE', userRole: 'admin', statusCode: 404 }));
    });
  });

  describe('Recording', () => {
    it('should record who added what to a cart, when, and the result', async () => {
      await request
        .post('/api/v1/cart')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ productId, quantity: 2 })
        .expect(201);

      const row = await latest(alice.userId, 'cart.item_added');
      expect(row).toEqual(jasmine.objectContaining({
        userId: alice.userId,
        username: alice.username,
        userRole: 'customer',
        action: 'CREATE',
        method: 'POST',
        path: '/api/v1/cart',
        statusCode: 201,
        details: { productId, quantity: 2 },
      }));
      expect(Date.parse(String(row.createdAt))).not.toBeNaN();
    });

    it('should record a page view as READ', async () => {
      await request.get('/api/v1/cart').set('Authorization', `Bearer ${alice.token}`).expect(200);

      const row = await latest(alice.userId, 'cart.viewed');
      expect(row.action).toBe('READ');
      expect(row.statusCode).toBe(200);
    });

    it('should record which address was deleted, without the address itself', async () => {
      const created = await request
        .post('/api/v1/addresses')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ fullName: 'Alice Audit', address: '1 Log Lane', city: 'Jakarta', label: 'work' })
        .expect(201);
      const addressId = created.body.data.id;
      await request
        .delete(`/api/v1/addresses/${addressId}`)
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(200);

      const deleted = await latest(alice.userId, 'address.deleted');
      expect(deleted.action).toBe('DELETE');
      expect(deleted.path).toBe(`/api/v1/addresses/${addressId}`);

      const createdRow = await latest(alice.userId, 'address.created');
      expect(createdRow.details).toEqual({ label: 'work' });
      expect(JSON.stringify(createdRow)).not.toContain('1 Log Lane');
    });

    it('should record a request that was refused', async () => {
      await request.get('/api/v1/admin/users').set('Authorization', `Bearer ${alice.token}`).expect(403);

      const row = await latest(alice.userId, 'admin.user_list_viewed');
      expect(row.statusCode).toBe(403);
    });

    it('should name the fields an update changed, never their values', async () => {
      const bob = await registerCustomer('auditbob');
      const newPassword = 'bobs-new-secret-42';
      await request
        .put(`/api/v1/users/${bob.userId}`)
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ firstName: 'Robert', password: newPassword })
        .expect(200);

      const row = await latest(bob.userId, 'user.updated');
      expect(row.details).toEqual({ changed: ['firstName', 'password'] });
      expect(JSON.stringify(row)).not.toContain(newPassword);
    });

    it('should not record a request without a signed-in user', async () => {
      await request.get('/api/v1/orders/424242').expect(401);
      await flushAuditLog();

      const { rows } = await pool.query(`SELECT COUNT(*) FROM audit_logs WHERE path = '/api/v1/orders/424242'`);
      expect(parseInt(rows[0].count, 10)).toBe(0);
    });

    it('should not record reads of the audit log itself', async () => {
      await readLog({});
      const rows = await logsFor(admin.userId);
      expect(rows.some((r) => r.method === 'GET' && r.path === '/api/v1/admin/audit-logs')).toBeFalse();
    });
  });

  describe('Auth events', () => {
    it('should record a registration and a login as one entry each', async () => {
      const carol = await registerCustomer('auditcarol');
      await flushAuditLog();
      await request.post('/api/v1/auth/login').send({ username: carol.username, password: carol.password }).expect(200);

      const rows = await logsFor(carol.userId);
      expect(rows.map((r) => r.event)).toEqual(['user.logged_in', 'user.registered']);
      expect(rows[0]).toEqual(jasmine.objectContaining({
        action: 'LOGIN', username: carol.username, userRole: 'customer', path: '/api/v1/auth/login', statusCode: 200,
      }));
      expect(rows[1]).toEqual(jasmine.objectContaining({ action: 'REGISTER', statusCode: 201 }));
    });

    it('should record a failed login against the account, without the password', async () => {
      const wrongPassword = 'not-alices-password-99';
      await request.post('/api/v1/auth/login').send({ username: alice.username, password: wrongPassword }).expect(401);

      const row = await latest(alice.userId, 'user.login_failed');
      expect(row).toEqual(jasmine.objectContaining({ action: 'LOGIN_FAILED', username: alice.username, statusCode: 401 }));
      expect(JSON.stringify(row)).not.toContain(wrongPassword);
    });

    it('should record a failed login for a username that does not exist', async () => {
      const username = `nobody_${Date.now()}`;
      await request.post('/api/v1/auth/login').send({ username, password: 'whatever123' }).expect(401);

      const { rows } = await readLog({ username, action: 'LOGIN_FAILED' });
      expect(rows.length).toBe(1);
      expect(rows[0].userId).toBeNull();
      expect(rows[0].username).toBe(username);
    });

    it('should record a logout', async () => {
      const login = await request
        .post('/api/v1/auth/login')
        .send({ username: alice.username, password: alice.password })
        .expect(200);
      await request.post('/api/v1/auth/logout').send({ refreshToken: login.body.data.refreshToken }).expect(200);

      const row = await latest(alice.userId, 'user.logged_out');
      expect(row.action).toBe('LOGOUT');
    });

    it('should record a replayed refresh token as a security event', async () => {
      const login = await request
        .post('/api/v1/auth/login')
        .send({ username: alice.username, password: alice.password })
        .expect(200);
      const original = login.body.data.refreshToken;
      await request.post('/api/v1/auth/refresh').send({ refreshToken: original }).expect(200);
      await request.post('/api/v1/auth/refresh').send({ refreshToken: original }).expect(401);

      const row = await latest(alice.userId, 'auth.refresh_token_reuse');
      expect(row).toEqual(jasmine.objectContaining({ action: 'SECURITY', path: '/api/v1/auth/refresh', statusCode: 401 }));
    });
  });

  describe('POST /page-views', () => {
    it('should record the page as a PAGE_VIEW entry, in place of the API route', async () => {
      await request
        .post('/api/v1/page-views')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ path: `/products/${productId}`, page: 'Product detail' })
        .expect(201);

      const row = await latest(alice.userId, 'page.viewed');
      expect(row).toEqual(jasmine.objectContaining({
        action: 'PAGE_VIEW',
        method: null,
        path: `/products/${productId}`,
        statusCode: 201,
        details: { page: 'Product detail' },
      }));
    });

    it('should write one entry per report, with no details when no page name is sent', async () => {
      const erin = await registerCustomer('auditerin');
      await request.post('/api/v1/page-views').set('Authorization', `Bearer ${erin.token}`).send({ path: '/cart' }).expect(201);

      const rows = await logsFor(erin.userId);
      expect(rows.map((r) => r.event).sort()).toEqual(['page.viewed', 'user.registered']);
      expect(rows.find((r) => r.event === 'page.viewed')?.details).toBeNull();
    });

    it('should require a signed-in user', async () => {
      await request.post('/api/v1/page-views').send({ path: '/products' }).expect(401);
    });

    it('should refuse anything but a page path, and record the refusal', async () => {
      const refused = [
        {}, { path: 'products' }, { path: '/products?search=lamp' }, { path: '/has space' },
        { path: `/${'x'.repeat(300)}` }, { path: '/cart', page: 'x'.repeat(61) },
      ];
      for (const body of refused) {
        await request.post('/api/v1/page-views').set('Authorization', `Bearer ${alice.token}`).send(body).expect(400);
      }

      const row = await latest(alice.userId, 'page.view_rejected');
      expect(row).toEqual(jasmine.objectContaining({ action: 'CREATE', path: '/api/v1/page-views', statusCode: 400 }));
    });

    it('should be listed by the PAGE_VIEW type filter', async () => {
      const { rows } = await readLog({ userId: alice.userId, action: 'PAGE_VIEW' });
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.action === 'PAGE_VIEW')).toBeTrue();
    });
  });

  describe('Filters', () => {
    it('should filter by one or more types, in any letter case', async () => {
      const { rows } = await readLog({ userId: alice.userId, action: 'login,login_failed' });
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.action === 'LOGIN' || r.action === 'LOGIN_FAILED')).toBeTrue();
    });

    it('should filter by part of a username, in any letter case', async () => {
      const { rows } = await readLog({ username: alice.username.toUpperCase() });
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.username === alice.username)).toBeTrue();
    });

    it('should filter by result', async () => {
      const failures = await readLog({ userId: alice.userId, result: 'failure' });
      const successes = await readLog({ userId: alice.userId, result: 'success' });
      const all = await readLog({ userId: alice.userId });

      expect(failures.rows.length).toBeGreaterThan(0);
      expect(failures.rows.every((r) => (r.statusCode ?? 0) >= 400)).toBeTrue();
      expect(successes.rows.every((r) => (r.statusCode ?? 0) < 400)).toBeTrue();
      expect(failures.total + successes.total).toBe(all.total);
    });

    it('should filter by time range', async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      expect((await readLog({ userId: alice.userId, from: tomorrow })).total).toBe(0);
      expect((await readLog({ userId: alice.userId, to: '2000-01-01T00:00:00Z' })).total).toBe(0);
      expect((await readLog({ userId: alice.userId, from: '2000-01-01T00:00:00Z', to: tomorrow })).total).toBeGreaterThan(0);
    });

    it('should page through the log newest first', async () => {
      const all = await readLog({ userId: alice.userId });
      const first = await readLog({ userId: alice.userId, limit: 2, offset: 0 });
      const second = await readLog({ userId: alice.userId, limit: 2, offset: 2 });

      expect(first.rows.map((r) => r.id)).toEqual(all.rows.slice(0, 2).map((r) => r.id));
      expect(second.rows.map((r) => r.id)).toEqual(all.rows.slice(2, 4).map((r) => r.id));
      const times = all.rows.map((r) => Date.parse(String(r.createdAt)));
      expect(times).toEqual([...times].sort((a, b) => b - a));
    });

    it('should reject an unknown type, result or date', async () => {
      for (const query of [{ action: 'CREATE,NOPE' }, { result: 'maybe' }, { from: 'yesterday-ish' }]) {
        await request
          .get('/api/v1/admin/audit-logs')
          .query(query)
          .set('Authorization', `Bearer ${admin.token}`)
          .expect(400);
      }
    });
  });

  describe('History', () => {
    it('should keep a user\'s entries after the account is deleted', async () => {
      const dave = await registerCustomer('auditdave');
      await request.get('/api/v1/cart').set('Authorization', `Bearer ${dave.token}`).expect(200);
      await flushAuditLog();
      await request.delete(`/api/v1/admin/users/${dave.userId}`).set('Authorization', `Bearer ${admin.token}`).expect(200);

      const rows = await logsFor(dave.userId);
      expect(rows.map((r) => r.event).sort()).toEqual(['cart.viewed', 'user.registered']);
      expect(rows.every((r) => r.username === dave.username)).toBeTrue();
    });

    it('should delete entries older than the retention period', async () => {
      const userId = 900000000 + Math.floor(Math.random() * 1e6);
      await pool.query(
        `INSERT INTO audit_logs (user_id, action, event, created_at) VALUES
           ($1, 'READ', 'test.expired', NOW() - ($2::int + 1) * INTERVAL '1 day'),
           ($1, 'READ', 'test.kept',    NOW() - ($2::int - 1) * INTERVAL '1 day')`,
        [userId, config.auditLogRetentionDays]
      );

      await purgeExpiredAuditLogs();

      const { rows } = await pool.query('SELECT event FROM audit_logs WHERE user_id = $1', [userId]);
      expect(rows.map((r) => r.event)).toEqual(['test.kept']);
      await pool.query('DELETE FROM audit_logs WHERE user_id = $1', [userId]);
    });
  });
});
