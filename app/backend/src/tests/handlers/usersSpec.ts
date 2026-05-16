import supertest from 'supertest';
import app from '../../server';

const request = supertest(app);
let token: string;

describe('User Endpoints', () => {
  const adminUser = {
    username: 'admin_userstest_' + Date.now(),
    password: 'adminpass123',
    firstName: 'Admin',
    lastName: 'Test',
  };

  beforeAll(async () => {
    const res = await request.post('/auth/register').send(adminUser);
    token = res.body.data.accessToken;
  });

  const testUser = {
    firstName: 'API',
    lastName: 'Test',
    username: 'apitest_' + Date.now(),
    password: 'testpass123',
  };

  it('POST /users should create a new user', async () => {
    const response = await request
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send(testUser)
      .expect(201);

    expect(response.body.data).toBeDefined();
    expect(response.body.data.username).toBe(testUser.username);
  });

  it('GET /users should require token', async () => {
    await request.get('/users').expect(401);
  });

  it('GET /users should return list of users with token', async () => {
    const response = await request
      .get('/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it('GET /users/:id should return a user with recentPurchases', async () => {
    const usersResponse = await request
      .get('/users')
      .set('Authorization', `Bearer ${token}`);

    const userId = usersResponse.body.data[0].id;

    const response = await request
      .get(`/users/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.data.id).toBe(userId);
    expect(response.body.data.recentPurchases).toBeDefined();
    expect(Array.isArray(response.body.data.recentPurchases)).toBe(true);
  });

  it('GET /users/:id recentPurchases should contain purchase data from completed orders', async () => {
    const usersResponse = await request
      .get('/users')
      .set('Authorization', `Bearer ${token}`);
    const userId = usersResponse.body.data[0].id;

    // Create a product
    const productRes = await request
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
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
    const usersResponse = await request
      .get('/users')
      .set('Authorization', `Bearer ${token}`);
    const userId = usersResponse.body.data[0].id;

    const response = await request
      .get(`/users/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.data.recentPurchases.length).toBeLessThanOrEqual(5);
  });

  it('PUT /users/:id should update a user with token', async () => {
    const usersResponse = await request
      .get('/users')
      .set('Authorization', `Bearer ${token}`);

    const userId = usersResponse.body.data[0].id;

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

  it('DELETE /users/:id should delete a user with token', async () => {
    const createRes = await request
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        firstName: 'Delete',
        lastName: 'Me',
        username: 'deleteme_' + Date.now(),
        password: 'testpass123',
      });

    const deleteUserId = createRes.body.data.id;

    const response = await request
      .delete(`/users/${deleteUserId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.data.id).toBe(deleteUserId);
  });

  describe('Input Validation', () => {
    it('POST /users should return 400 when firstName is missing', async () => {
      const response = await request
        .post('/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ lastName: 'Test', username: 'noname', password: 'pass123' })
        .expect(400);
      expect(response.body.message).toBe('firstName is required and must be a non-empty string');
    });

    it('POST /users should return 400 when lastName is missing', async () => {
      const response = await request
        .post('/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ firstName: 'Test', username: 'nolast', password: 'pass123' })
        .expect(400);
      expect(response.body.message).toBe('lastName is required and must be a non-empty string');
    });

    it('POST /users should return 400 when username is missing', async () => {
      const response = await request
        .post('/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ firstName: 'Test', lastName: 'User', password: 'pass123' })
        .expect(400);
      expect(response.body.message).toBe('username is required and must be a non-empty string');
    });

    it('POST /users should return 400 when password is missing', async () => {
      const response = await request
        .post('/users')
        .set('Authorization', `Bearer ${token}`)
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

    it('GET /users/:id should return 404 for nonexistent id', async () => {
      const response = await request
        .get('/users/99999')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
      expect(response.body.message).toBe('user with id 99999 not found');
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
        .put('/users/1')
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
