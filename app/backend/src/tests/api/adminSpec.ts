import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import { createAdmin } from '../support/admin';
import { TestAdmin, TestCustomer } from '../../types/test.types';

const request = supertest(app);
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'default-secret-for-dev';

const registerCustomer = async (prefix: string): Promise<TestCustomer> => {
  const username = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const password = 'customerpass123';
  const res = await request
    .post('/api/v1/auth/register')
    .send({ username, password, firstName: 'Cust', lastName: 'Omer' })
    .expect(201);
  return { userId: res.body.data.user.id, token: res.body.data.accessToken, refreshToken: res.body.data.refreshToken, username, password };
};

describe('Admin Endpoints', () => {
  let admin: TestAdmin;
  let alice: TestCustomer;
  let bob: TestCustomer;
  let productId: number;

  beforeAll(async () => {
    admin = await createAdmin(request);
    alice = await registerCustomer('alice');
    bob = await registerCustomer('bob');

    const productRes = await request
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Admin Spec Product', price: 10, category: 'AdminSpec', stock: 50 })
      .expect(201);
    productId = productRes.body.data.id;
  });

  describe('Access control', () => {
    it('should reject requests without a token', async () => {
      const res = await request.get('/api/v1/admin/users').expect(401);
      expect(res.body.code).toBe('no_token');
    });

    it('should return 403 for a customer token', async () => {
      const res = await request
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(403);
      expect(res.body.message).toBe('Admin access required');
    });

    it('should return 403 for a token that claims admin but whose account is not an admin', async () => {
      const forged = jwt.sign({ userId: alice.userId, role: 'admin' }, TOKEN_SECRET, { expiresIn: '5m' });
      await request
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${forged}`)
        .expect(403);
    });

    it('should allow an admin token', async () => {
      await request
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);
    });

    it('login should include the role in the user and in the access token', async () => {
      const res = await request
        .post('/api/v1/auth/login')
        .send({ username: admin.username, password: admin.password })
        .expect(200);
      expect(res.body.data.user.role).toBe('admin');
      const decoded = jwt.verify(res.body.data.accessToken, TOKEN_SECRET) as { role: string };
      expect(decoded.role).toBe('admin');
    });

    it('POST /auth/register should ignore a role sent in the body', async () => {
      const res = await request
        .post('/api/v1/auth/register')
        .send({ username: 'wannabe_' + Date.now(), password: 'password123', firstName: 'W', lastName: 'B', role: 'admin' })
        .expect(201);
      expect(res.body.data.user.role).toBe('customer');
      const decoded = jwt.verify(res.body.data.accessToken, TOKEN_SECRET) as { role: string };
      expect(decoded.role).toBe('customer');
    });

    it('PUT /users/:id should ignore a role sent in the body', async () => {
      await request
        .put(`/api/v1/users/${alice.userId}`)
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ firstName: 'Alice', role: 'admin' })
        .expect(200);

      const me = await request.get('/api/v1/auth/me').set('Authorization', `Bearer ${alice.token}`).expect(200);
      expect(me.body.data.role).toBe('customer');

      await request.get('/api/v1/admin/users').set('Authorization', `Bearer ${alice.token}`).expect(403);
    });
  });

  describe('Users', () => {
    let createdUserId: number;

    it('GET /admin/users should list every user with roles and without passwords', async () => {
      const res = await request
        .get('/api/v1/admin/users?limit=100')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);
      const ids = res.body.data.map((u: { id: number }) => u.id);
      expect(ids).toContain(alice.userId);
      expect(ids).toContain(bob.userId);
      res.body.data.forEach((u: { role: string; password?: string }) => {
        expect(['customer', 'admin']).toContain(u.role);
        expect(u.password).toBeUndefined();
      });
    });

    it('GET /admin/users should paginate with limit and offset', async () => {
      const first = await request.get('/api/v1/admin/users?limit=1').set('Authorization', `Bearer ${admin.token}`).expect(200);
      const second = await request.get('/api/v1/admin/users?limit=1&offset=1').set('Authorization', `Bearer ${admin.token}`).expect(200);
      expect(first.body.data.length).toBe(1);
      expect(second.body.data.length).toBe(1);
      expect(first.body.data[0].id).not.toBe(second.body.data[0].id);
    });

    it('GET /admin/users should reject an out-of-range limit', async () => {
      const res = await request.get('/api/v1/admin/users?limit=101').set('Authorization', `Bearer ${admin.token}`).expect(400);
      expect(res.body.message).toBe('limit must be an integer between 1 and 100');
      await request.get('/api/v1/admin/users?limit=0').set('Authorization', `Bearer ${admin.token}`).expect(400);
      await request.get('/api/v1/admin/users?offset=-1').set('Authorization', `Bearer ${admin.token}`).expect(400);
    });

    it('GET /admin/users/:id should return any user with recentPurchases', async () => {
      const res = await request
        .get(`/api/v1/admin/users/${alice.userId}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);
      expect(res.body.data.id).toBe(alice.userId);
      expect(Array.isArray(res.body.data.recentPurchases)).toBe(true);
    });

    it('GET /admin/users/:id should return 404 for an unknown id', async () => {
      await request.get('/api/v1/admin/users/999999').set('Authorization', `Bearer ${admin.token}`).expect(404);
    });

    it('POST /admin/users should create a user with an explicit role', async () => {
      const res = await request
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ username: 'staff_' + Date.now(), password: 'staffpass123', firstName: 'Staff', lastName: 'Member', role: 'admin' })
        .expect(201);
      expect(res.body.data.role).toBe('admin');
      createdUserId = res.body.data.id;
    });

    it('POST /admin/users should default the role to customer', async () => {
      const res = await request
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ username: 'plain_' + Date.now(), password: 'plainpass123', firstName: 'Plain', lastName: 'User' })
        .expect(201);
      expect(res.body.data.role).toBe('customer');
    });

    it('POST /admin/users should reject an unknown role and a short password', async () => {
      const bad = await request
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ username: 'badrole_' + Date.now(), password: 'password123', firstName: 'A', lastName: 'B', role: 'superuser' })
        .expect(400);
      expect(bad.body.message).toBe('role must be one of: customer, admin');

      await request
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ username: 'short_' + Date.now(), password: 'short', firstName: 'A', lastName: 'B' })
        .expect(400);
    });

    it('PUT /admin/users/:id should update another user\'s profile', async () => {
      const res = await request
        .put(`/api/v1/admin/users/${createdUserId}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ firstName: 'Renamed' })
        .expect(200);
      expect(res.body.data.firstName).toBe('Renamed');
    });

    it('PUT /admin/users/:id/role should promote a customer and revoke their refresh tokens', async () => {
      const res = await request
        .put(`/api/v1/admin/users/${bob.userId}/role`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ role: 'admin' })
        .expect(200);
      expect(res.body.data.role).toBe('admin');

      await request.post('/api/v1/auth/refresh').send({ refreshToken: bob.refreshToken }).expect(401);

      const login = await request.post('/api/v1/auth/login').send({ username: bob.username, password: bob.password }).expect(200);
      expect(login.body.data.user.role).toBe('admin');
      await request.get('/api/v1/admin/users').set('Authorization', `Bearer ${login.body.data.accessToken}`).expect(200);
      bob.token = login.body.data.accessToken;
    });

    it('PUT /admin/users/:id/role should demote an admin and block their existing access token immediately', async () => {
      await request
        .put(`/api/v1/admin/users/${bob.userId}/role`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ role: 'customer' })
        .expect(200);

      await request.get('/api/v1/admin/users').set('Authorization', `Bearer ${bob.token}`).expect(403);

      const login = await request.post('/api/v1/auth/login').send({ username: bob.username, password: bob.password }).expect(200);
      expect(login.body.data.user.role).toBe('customer');
      bob.token = login.body.data.accessToken;
    });

    it('PUT /admin/users/:id/role should reject an invalid role', async () => {
      await request
        .put(`/api/v1/admin/users/${alice.userId}/role`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ role: 'root' })
        .expect(400);
    });

    it('PUT /admin/users/:id/role should not let an admin change their own role', async () => {
      const res = await request
        .put(`/api/v1/admin/users/${admin.userId}/role`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ role: 'customer' })
        .expect(400);
      expect(res.body.message).toBe('You cannot change your own role');
    });

    it('DELETE /admin/users/:id should not let an admin delete their own account', async () => {
      await request.delete(`/api/v1/admin/users/${admin.userId}`).set('Authorization', `Bearer ${admin.token}`).expect(400);
    });

    it('DELETE /admin/users/:id should delete another user', async () => {
      const res = await request
        .delete(`/api/v1/admin/users/${createdUserId}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);
      expect(res.body.data.id).toBe(createdUserId);
      await request.get(`/api/v1/admin/users/${createdUserId}`).set('Authorization', `Bearer ${admin.token}`).expect(404);
    });

    it('admin may also use the customer user routes on any account', async () => {
      const res = await request
        .get(`/api/v1/users/${alice.userId}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);
      expect(res.body.data.id).toBe(alice.userId);
    });
  });

  describe('Orders', () => {
    let orderId: number;

    it('POST /admin/orders should create an order for any user', async () => {
      const res = await request
        .post('/api/v1/admin/orders')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ userId: alice.userId })
        .expect(201);
      expect(res.body.data.userId).toBe(alice.userId);
      expect(res.body.data.status).toBe('active');
      orderId = res.body.data.id;
    });

    it('POST /admin/orders should return 404 for an unknown user and 400 for a bad status', async () => {
      await request.post('/api/v1/admin/orders').set('Authorization', `Bearer ${admin.token}`).send({ userId: 999999 }).expect(404);
      await request.post('/api/v1/admin/orders').set('Authorization', `Bearer ${admin.token}`).send({ userId: alice.userId, status: 'shipped' }).expect(400);
      await request.post('/api/v1/admin/orders').set('Authorization', `Bearer ${admin.token}`).send({}).expect(400);
    });

    it('GET /admin/orders should list orders across users and support filters', async () => {
      const all = await request.get('/api/v1/admin/orders?limit=100').set('Authorization', `Bearer ${admin.token}`).expect(200);
      expect(all.body.data.map((o: { id: number }) => o.id)).toContain(orderId);

      const byUser = await request.get(`/api/v1/admin/orders?userId=${alice.userId}`).set('Authorization', `Bearer ${admin.token}`).expect(200);
      expect(byUser.body.data.length).toBeGreaterThan(0);
      byUser.body.data.forEach((o: { userId: number }) => expect(o.userId).toBe(alice.userId));

      const byStatus = await request.get('/api/v1/admin/orders?status=active&limit=100').set('Authorization', `Bearer ${admin.token}`).expect(200);
      byStatus.body.data.forEach((o: { status: string }) => expect(o.status).toBe('active'));

      await request.get('/api/v1/admin/orders?status=bogus').set('Authorization', `Bearer ${admin.token}`).expect(400);
      await request.get('/api/v1/admin/orders?userId=abc').set('Authorization', `Bearer ${admin.token}`).expect(400);
    });

    it('GET /admin/orders/:id should return any order', async () => {
      const res = await request.get(`/api/v1/admin/orders/${orderId}`).set('Authorization', `Bearer ${admin.token}`).expect(200);
      expect(res.body.data.id).toBe(orderId);
      await request.get('/api/v1/admin/orders/999999').set('Authorization', `Bearer ${admin.token}`).expect(404);
    });

    it('POST and GET /admin/orders/:id/products should manage products on any order', async () => {
      const add = await request
        .post(`/api/v1/admin/orders/${orderId}/products`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ productId, quantity: 2 })
        .expect(200);
      expect(add.body.data.orderId).toBe(orderId);

      const list = await request.get(`/api/v1/admin/orders/${orderId}/products`).set('Authorization', `Bearer ${admin.token}`).expect(200);
      expect(list.body.data.length).toBe(1);
      expect(list.body.data[0].productId).toBe(productId);
    });

    it('PUT /admin/orders/:id should update any order status', async () => {
      const res = await request
        .put(`/api/v1/admin/orders/${orderId}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'complete' })
        .expect(200);
      expect(res.body.data.status).toBe('complete');

      const own = await request.get(`/api/v1/orders/${orderId}`).set('Authorization', `Bearer ${alice.token}`).expect(200);
      expect(own.body.data.status).toBe('complete');
    });

    it('admin may also use the customer order routes on any order', async () => {
      await request.get(`/api/v1/orders/${orderId}`).set('Authorization', `Bearer ${admin.token}`).expect(200);
      const filtered = await request.get(`/api/v1/orders?userId=${alice.userId}`).set('Authorization', `Bearer ${admin.token}`).expect(200);
      filtered.body.data.forEach((o: { userId: number }) => expect(o.userId).toBe(alice.userId));
      await request.get(`/api/v1/orders/user/${alice.userId}/completed`).set('Authorization', `Bearer ${admin.token}`).expect(200);
    });

    it('a customer still cannot reach another user\'s order', async () => {
      await request.get(`/api/v1/orders/${orderId}`).set('Authorization', `Bearer ${bob.token}`).expect(404);
    });

    it('DELETE /admin/orders/:id should delete any order', async () => {
      await request.delete(`/api/v1/admin/orders/${orderId}`).set('Authorization', `Bearer ${admin.token}`).expect(200);
      await request.get(`/api/v1/admin/orders/${orderId}`).set('Authorization', `Bearer ${admin.token}`).expect(404);
    });
  });

  describe('Carts', () => {
    let cartItemId: number;

    it('POST /admin/carts/:userId should add an item to any user\'s cart', async () => {
      const res = await request
        .post(`/api/v1/admin/carts/${alice.userId}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ productId, quantity: 2 })
        .expect(201);
      expect(res.body.data.userId).toBe(alice.userId);
      expect(res.body.data.quantity).toBe(2);
      cartItemId = res.body.data.id;
    });

    it('POST /admin/carts/:userId should return 404 for an unknown user', async () => {
      await request.post('/api/v1/admin/carts/999999').set('Authorization', `Bearer ${admin.token}`).send({ productId, quantity: 1 }).expect(404);
    });

    it('GET /admin/carts should list cart items across users and filter by userId', async () => {
      const all = await request.get('/api/v1/admin/carts?limit=100').set('Authorization', `Bearer ${admin.token}`).expect(200);
      const mine = all.body.data.find((i: { id: number }) => i.id === cartItemId);
      expect(mine).toBeDefined();
      expect(mine.productName).toBe('Admin Spec Product');

      const byUser = await request.get(`/api/v1/admin/carts?userId=${alice.userId}`).set('Authorization', `Bearer ${admin.token}`).expect(200);
      byUser.body.data.forEach((i: { userId: number }) => expect(i.userId).toBe(alice.userId));
    });

    it('GET /admin/carts/:userId should return one user\'s cart', async () => {
      const res = await request.get(`/api/v1/admin/carts/${alice.userId}`).set('Authorization', `Bearer ${admin.token}`).expect(200);
      expect(res.body.data.map((i: { id: number }) => i.id)).toContain(cartItemId);
    });

    it('GET and PUT /admin/cart-items/:id should read and update any cart item', async () => {
      const shown = await request.get(`/api/v1/admin/cart-items/${cartItemId}`).set('Authorization', `Bearer ${admin.token}`).expect(200);
      expect(shown.body.data.id).toBe(cartItemId);

      const updated = await request
        .put(`/api/v1/admin/cart-items/${cartItemId}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ quantity: 5 })
        .expect(200);
      expect(updated.body.data.quantity).toBe(5);

      const own = await request.get('/api/v1/cart').set('Authorization', `Bearer ${alice.token}`).expect(200);
      expect(own.body.data.find((i: { id: number }) => i.id === cartItemId).quantity).toBe(5);

      await request.put(`/api/v1/admin/cart-items/${cartItemId}`).set('Authorization', `Bearer ${admin.token}`).send({ quantity: 0 }).expect(400);
    });

    it('DELETE /admin/cart-items/:id should remove any cart item', async () => {
      await request.delete(`/api/v1/admin/cart-items/${cartItemId}`).set('Authorization', `Bearer ${admin.token}`).expect(200);
      await request.get(`/api/v1/admin/cart-items/${cartItemId}`).set('Authorization', `Bearer ${admin.token}`).expect(404);
    });

    it('DELETE /admin/carts/:userId should clear any user\'s cart', async () => {
      await request.post(`/api/v1/admin/carts/${alice.userId}`).set('Authorization', `Bearer ${admin.token}`).send({ productId, quantity: 1 }).expect(201);
      await request.delete(`/api/v1/admin/carts/${alice.userId}`).set('Authorization', `Bearer ${admin.token}`).expect(200);

      const own = await request.get('/api/v1/cart').set('Authorization', `Bearer ${alice.token}`).expect(200);
      expect(own.body.data).toEqual([]);
    });
  });

  describe('Addresses', () => {
    let addressId: number;

    it('POST /admin/addresses should create an address for any user', async () => {
      const res = await request
        .post('/api/v1/admin/addresses')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ userId: alice.userId, fullName: 'Alice A', address: '1 Main St', city: 'Springfield', label: 'work' })
        .expect(201);
      expect(res.body.data.userId).toBe(alice.userId);
      expect(res.body.data.label).toBe('work');
      addressId = res.body.data.id;
    });

    it('POST /admin/addresses should validate userId and required fields', async () => {
      await request.post('/api/v1/admin/addresses').set('Authorization', `Bearer ${admin.token}`).send({ fullName: 'X', address: 'Y', city: 'Z' }).expect(400);
      await request.post('/api/v1/admin/addresses').set('Authorization', `Bearer ${admin.token}`).send({ userId: 999999, fullName: 'X', address: 'Y', city: 'Z' }).expect(404);
      await request.post('/api/v1/admin/addresses').set('Authorization', `Bearer ${admin.token}`).send({ userId: alice.userId, fullName: 'X' }).expect(400);
    });

    it('GET /admin/addresses should list addresses across users and filter by userId', async () => {
      const all = await request.get('/api/v1/admin/addresses?limit=100').set('Authorization', `Bearer ${admin.token}`).expect(200);
      expect(all.body.data.map((a: { id: number }) => a.id)).toContain(addressId);

      const byUser = await request.get(`/api/v1/admin/addresses?userId=${alice.userId}`).set('Authorization', `Bearer ${admin.token}`).expect(200);
      byUser.body.data.forEach((a: { userId: number }) => expect(a.userId).toBe(alice.userId));
    });

    it('GET and PUT /admin/addresses/:id should read and update any address', async () => {
      const shown = await request.get(`/api/v1/admin/addresses/${addressId}`).set('Authorization', `Bearer ${admin.token}`).expect(200);
      expect(shown.body.data.id).toBe(addressId);

      const updated = await request
        .put(`/api/v1/admin/addresses/${addressId}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ city: 'Shelbyville' })
        .expect(200);
      expect(updated.body.data.city).toBe('Shelbyville');

      const own = await request.get(`/api/v1/addresses/${addressId}`).set('Authorization', `Bearer ${alice.token}`).expect(200);
      expect(own.body.data.city).toBe('Shelbyville');

      await request.put(`/api/v1/admin/addresses/${addressId}`).set('Authorization', `Bearer ${admin.token}`).send({}).expect(400);
      await request.put('/api/v1/admin/addresses/999999').set('Authorization', `Bearer ${admin.token}`).send({ city: 'X' }).expect(404);
    });

    it('DELETE /admin/addresses/:id should delete any address', async () => {
      await request.delete(`/api/v1/admin/addresses/${addressId}`).set('Authorization', `Bearer ${admin.token}`).expect(200);
      await request.get(`/api/v1/admin/addresses/${addressId}`).set('Authorization', `Bearer ${admin.token}`).expect(404);
    });
  });

  describe('Error handling', () => {
    it('should return a clean 400 for malformed JSON', async () => {
      const res = await request
        .post('/api/v1/admin/orders')
        .set('Authorization', `Bearer ${admin.token}`)
        .set('Content-Type', 'application/json')
        .send('{"userId": ')
        .expect(400);
      expect(res.body.message).toBe('Request body must be valid JSON');
    });
  });

  describe('Shared rules', () => {
    it('PUT /admin/users/:id should reject a password shorter than 8 characters', async () => {
      const res = await request
        .put(`/api/v1/admin/users/${alice.userId}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ password: 'short' })
        .expect(400);
      expect(res.body.message).toBe('password must be at least 8 characters');
    });

    it('GET /admin/orders should include the total alongside the page', async () => {
      const res = await request
        .get('/api/v1/admin/orders?limit=1')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);
      expect(res.body.meta.limit).toBe(1);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(res.body.data.length);
    });
  });
});
