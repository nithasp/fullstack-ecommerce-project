import supertest from 'supertest';
import app from '../../server';
import { createAdmin } from '../support/admin';

const request = supertest(app);
let token: string;       // customer: own-account routes
let userId: number;
let adminToken: string;  // admin: list/create users, create products

describe('User Endpoints', () => {
  const customer = {
    username: 'customer_userstest_' + Date.now(),
    password: 'customerpass123',
    firstName: 'Customer',
    lastName: 'Test',
  };

  beforeAll(async () => {
    const res = await request.post('/auth/register').send(customer);
    token = res.body.data.accessToken;
    userId = res.body.data.user.id;
    adminToken = (await createAdmin(request, 'usersadmin')).token;
  });

  const testUser = {
    firstName: 'API',
    lastName: 'Test',
    username: 'apitest_' + Date.now(),
    password: 'testpass123',
  };

  it('POST /users should create a new user with an admin token', async () => {
    const response = await request
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(testUser)
      .expect(201);

    expect(response.body.data).toBeDefined();
    expect(response.body.data.username).toBe(testUser.username);
    expect(response.body.data.role).toBe('customer');
  });

  it('POST /users should return 403 for a customer', async () => {
    await request
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...testUser, username: 'blocked_' + Date.now() })
      .expect(403);
  });

  it('GET /users should require token', async () => {
    await request.get('/users').expect(401);
  });

  it('GET /users should return 403 for a customer', async () => {
    const response = await request
      .get('/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    expect(response.body.message).toBe('Admin access required');
  });

  it('GET /users should return list of users with an admin token', async () => {
    const response = await request
      .get('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(response.body.data)).toBe(true);
    response.body.data.forEach((u: { password?: string }) => expect(u.password).toBeUndefined());
  });

  it('GET /users/:id should return a user with recentPurchases', async () => {
    const response = await request
      .get(`/users/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.data.id).toBe(userId);
    expect(response.body.data.recentPurchases).toBeDefined();
    expect(Array.isArray(response.body.data.recentPurchases)).toBe(true);
  });

  it('GET /users/:id recentPurchases should contain purchase data from completed orders', async () => {
    // Create a product
    const productRes = await request
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Recent Purchase Item', price: 29.99, category: 'TestCat' });
    const productId = productRes.body.data.id;

    // Create an order, add the product, then complete it
    const orderRes = await request
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ userId, status: 'active' });
    const orderId = orderRes.body.data.id;

    await request
      .post(`/orders/${orderId}/products`)
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 2 });

    await request
      .put(`/orders/${orderId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'complete' });

    // Now fetch user show and verify recentPurchases
    const response = await request
      .get(`/users/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.data.recentPurchases).toBeDefined();
    expect(response.body.data.recentPurchases.length).toBeGreaterThan(0);

    const purchase = response.body.data.recentPurchases.find(
      (p: { productId: number }) => p.productId === productId
    );
    expect(purchase).toBeDefined();
    expect(purchase.name).toBe('Recent Purchase Item');
    expect(purchase.quantity).toBe(2);
    expect(purchase.orderId).toBe(orderId);
  });

  it('GET /users/:id recentPurchases should return at most 5 items', async () => {
    const response = await request
      .get(`/users/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.data.recentPurchases.length).toBeLessThanOrEqual(5);
  });

  it('PUT /users/:id should update a user with token', async () => {
    const response = await request
      .put(`/users/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Updated' })
      .expect(200);

    expect(response.body.data.firstName).toBe('Updated');
  });

  it('PUT /users/:id should require token', async () => {
    await request.put('/users/1').send({ firstName: 'Fail' }).expect(401);
  });

  it('DELETE /users/:id should require token', async () => {
    await request.delete('/users/1').expect(401);
  });

  it('DELETE /users/:id should delete the token user', async () => {
    const registerRes = await request.post('/auth/register').send({
      firstName: 'Delete',
      lastName: 'Me',
      username: 'deleteme_' + Date.now(),
      password: 'testpass123',
    });
    const deleteUserId = registerRes.body.data.user.id;

    const response = await request
      .delete(`/users/${deleteUserId}`)
      .set('Authorization', `Bearer ${registerRes.body.data.accessToken}`)
      .expect(200);

    expect(response.body.data.id).toBe(deleteUserId);
  });

  describe('Ownership', () => {
    const otherUser = {
      firstName: 'Other',
      lastName: 'User',
      username: 'otheruser_' + Date.now(),
      password: 'otherpass123',
    };
    let otherUserId: number;

    beforeAll(async () => {
      const res = await request.post('/auth/register').send(otherUser);
      otherUserId = res.body.data.user.id;
    });

    it("GET /users/:id should return 403 for another user's account", async () => {
      const response = await request
        .get(`/users/${otherUserId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      expect(response.body.message).toBe('You can only access your own data');
    });

    it("PUT /users/:id should return 403 for another user's account and keep their password", async () => {
      await request
        .put(`/users/${otherUserId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'hijacked123' })
        .expect(403);

      await request
        .post('/auth/login')
        .send({ username: otherUser.username, password: otherUser.password })
        .expect(200);
    });

    it("DELETE /users/:id should return 403 for another user's account and keep it", async () => {
      await request
        .delete(`/users/${otherUserId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      const response = await request
        .get('/users')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.body.data.map((u: { id: number }) => u.id)).toContain(otherUserId);
    });
  });

  describe('Input Validation', () => {
    it('POST /users should return 400 when firstName is missing', async () => {
      const response = await request
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ lastName: 'Test', username: 'noname', password: 'pass123' })
        .expect(400);
      expect(response.body.message).toBe('firstName is required and must be a non-empty string');
    });

    it('POST /users should return 400 when lastName is missing', async () => {
      const response = await request
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Test', username: 'nolast', password: 'pass123' })
        .expect(400);
      expect(response.body.message).toBe('lastName is required and must be a non-empty string');
    });

    it('POST /users should return 400 when username is missing', async () => {
      const response = await request
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Test', lastName: 'User', password: 'pass123' })
        .expect(400);
      expect(response.body.message).toBe('username is required and must be a non-empty string');
    });

    it('POST /users should return 400 when password is missing', async () => {
      const response = await request
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Test', lastName: 'User', username: 'nopass' })
        .expect(400);
      expect(response.body.message).toBe('password is required and must be a non-empty string');
    });

    it('GET /users/:id should return 400 for invalid id', async () => {
      const response = await request
        .get('/users/abc')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
      expect(response.body.message).toBe('user id must be a valid positive integer');
    });

    it('GET /users/:id should return 404 when the account no longer exists', async () => {
      const registerRes = await request.post('/auth/register').send({
        firstName: 'Gone',
        lastName: 'User',
        username: 'goneuser_' + Date.now(),
        password: 'testpass123',
      });
      const goneUserId = registerRes.body.data.user.id;
      const goneToken = registerRes.body.data.accessToken;

      await request
        .delete(`/users/${goneUserId}`)
        .set('Authorization', `Bearer ${goneToken}`)
        .expect(200);

      // The access token stays valid until it expires, but the account is gone
      const response = await request
        .get(`/users/${goneUserId}`)
        .set('Authorization', `Bearer ${goneToken}`)
        .expect(404);
      expect(response.body.message).toBe(`user with id ${goneUserId} not found`);
    });

    it('PUT /users/:id should return 400 for invalid id', async () => {
      const response = await request
        .put('/users/abc')
        .set('Authorization', `Bearer ${token}`)
        .send({ firstName: 'Test' })
        .expect(400);
      expect(response.body.message).toBe('user id must be a valid positive integer');
    });

    it('PUT /users/:id should return 400 when no valid fields provided', async () => {
      const response = await request
        .put(`/users/${userId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);
      expect(response.body.message).toBe('at least one field (firstName, lastName, username, password) is required to update');
    });

    it('DELETE /users/:id should return 400 for invalid id', async () => {
      const response = await request
        .delete('/users/abc')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
      expect(response.body.message).toBe('user id must be a valid positive integer');
    });
  });
});
