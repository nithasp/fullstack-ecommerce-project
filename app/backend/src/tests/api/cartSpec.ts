import supertest from 'supertest';
import app from '../../app';
import { createAdmin } from '../support/admin';

const request = supertest(app);

describe('Cart Endpoints', () => {
  let token: string;
  let productId: number;

  beforeAll(async () => {
    const res = await request
      .post('/api/v1/auth/register')
      .send({ username: 'carttester_' + Date.now(), password: 'cartpass123' })
      .expect(201);
    token = res.body.data.accessToken;

    const admin = await createAdmin(request, 'cartadmin');
    const product = await request
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Cart Spec Product', price: 12.5, category: 'CartSpec', stock: 30 })
      .expect(201);
    productId = product.body.data.id;
  });

  it('GET /cart should require token', async () => {
    await request.get('/api/v1/cart').expect(401);
  });

  it('POST /cart should add an item that GET /cart then returns', async () => {
    await request
      .post('/api/v1/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 2 })
      .expect(201);

    const res = await request.get('/api/v1/cart').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].productId).toBe(productId);
    expect(res.body.data[0].quantity).toBe(2);
  });

  it('POST /cart should return 400 for a product that does not exist', async () => {
    const res = await request
      .post('/api/v1/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: 999999, quantity: 1 })
      .expect(400);
    expect(res.body.message).toBe('Product does not exist');
  });

  describe('POST /cart/checkout', () => {
    it('should return 400 when items is empty', async () => {
      const res = await request
        .post('/api/v1/cart/checkout')
        .set('Authorization', `Bearer ${token}`)
        .send({ items: [] })
        .expect(400);
      expect(res.body.message).toBe('items must be a non-empty array');
    });

    it('should return 400 for an item without a valid quantity', async () => {
      const res = await request
        .post('/api/v1/cart/checkout')
        .set('Authorization', `Bearer ${token}`)
        .send({ items: [{ productId }] })
        .expect(400);
      expect(res.body.message).toBe('quantity is required and must be a valid number');
    });

    it('should create no order and keep the cart when one product does not exist', async () => {
      const ordersBefore = await request.get('/api/v1/orders').set('Authorization', `Bearer ${token}`).expect(200);

      const res = await request
        .post('/api/v1/cart/checkout')
        .set('Authorization', `Bearer ${token}`)
        .send({ items: [{ productId, quantity: 1 }, { productId: 999999, quantity: 1 }] })
        .expect(400);
      expect(res.body.message).toBe('Product does not exist');

      const cart = await request.get('/api/v1/cart').set('Authorization', `Bearer ${token}`).expect(200);
      expect(cart.body.data.length).toBe(1);
      const ordersAfter = await request.get('/api/v1/orders').set('Authorization', `Bearer ${token}`).expect(200);
      expect(ordersAfter.body.meta.total).toBe(ordersBefore.body.meta.total);
    });

    it('should record a completed order with its products and empty the cart', async () => {
      const res = await request
        .post('/api/v1/cart/checkout')
        .set('Authorization', `Bearer ${token}`)
        .send({ items: [{ productId, quantity: 2 }] })
        .expect(201);
      const order = res.body.data.order;
      expect(order.status).toBe('complete');

      const lines = await request
        .get(`/api/v1/orders/${order.id}/products`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(lines.body.data.length).toBe(1);
      expect(lines.body.data[0].productId).toBe(productId);
      expect(lines.body.data[0].quantity).toBe(2);

      const cart = await request.get('/api/v1/cart').set('Authorization', `Bearer ${token}`).expect(200);
      expect(cart.body.data).toEqual([]);
    });
  });
});
