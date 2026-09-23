import { OrderRepository } from '../../repositories/order.repository';
import { UserRepository } from '../../repositories/user.repository';
import { signAccessToken } from '../../services/token.service';
import {
  api,
  API,
  cookieValue,
  refreshCookie,
  createAdmin,
  createProduct,
  registerBuyer,
} from '../support/api';

const users = new UserRepository();
const orders = new OrderRepository();

describe('User endpoints', () => {
  describe('GET /users/:id', () => {
    it('returns the caller with their recent purchases', async () => {
      const customer = await registerBuyer('profile');
      const res = await customer.get(`/users/${customer.id}`).expect(200);

      expect(res.body.data.username).toBe(customer.username);
      expect(Array.isArray(res.body.data.recentPurchases)).toBe(true);
    });

    it('refuses another account', async () => {
      const customer = await registerBuyer('owner');
      const other = await registerBuyer('other');

      const res = await customer.get(`/users/${other.id}`).expect(403);
      expect(res.body.code).toBe('forbidden');
    });

    it('refuses another account even for an admin token, which has /admin/users for that', async () => {
      const admin = await createAdmin('selfonly');
      const customer = await registerBuyer('target');
      await admin.get(`/users/${customer.id}`).expect(403);
    });

    it('ignores an admin role claimed by the token itself', async () => {
      const customer = await registerBuyer('claimer');
      const other = await registerBuyer('victim');
      const forged = signAccessToken({ id: customer.id, role: 'admin' });

      await api.get(`${API}/users/${other.id}`).set('Authorization', `Bearer ${forged}`).expect(403);
      await api.get(`${API}/admin/users`).set('Authorization', `Bearer ${forged}`).expect(403);
    });
  });

  describe('PATCH /users/:id', () => {
    it('updates profile fields', async () => {
      const customer = await registerBuyer('renamer');
      const res = await customer
        .patch(`/users/${customer.id}`, { firstName: 'Ada', lastName: 'Lovelace' })
        .expect(200);

      expect(res.body.data.firstName).toBe('Ada');
      expect(res.body.data.lastName).toBe('Lovelace');
    });

    it('needs at least one field', async () => {
      const customer = await registerBuyer('emptyupdate');
      const res = await customer.patch(`/users/${customer.id}`, {}).expect(400);
      expect(res.body.message).toBe('at least one of firstName, lastName or username is required');
    });

    it('cannot change the role', async () => {
      const customer = await registerBuyer('promoter');
      await customer.patch(`/users/${customer.id}`, { firstName: 'Still', role: 'admin' }).expect(200);

      const stored = await users.show(customer.id);
      expect(stored?.role).toBe('customer');
    });
  });

  describe('PUT /users/:id/password', () => {
    it('needs the current password', async () => {
      const customer = await registerBuyer('pwwrong');
      const res = await customer
        .put(`/users/${customer.id}/password`, { currentPassword: 'not-it', newPassword: 'brandnew123' })
        .expect(401);

      expect(res.body.code).toBe('invalid_credentials');
    });

    it('changes the password, ends other sessions and keeps this one signed in', async () => {
      const customer = await registerBuyer('pwchange');

      const elsewhere = await api
        .post(`${API}/auth/login`)
        .send({ username: customer.username, password: customer.password })
        .expect(200);
      const otherSession = cookieValue(refreshCookie(elsewhere) as string);

      const res = await customer
        .put(`/users/${customer.id}/password`, {
          currentPassword: customer.password,
          newPassword: 'brandnewpass123',
        })
        .expect(200);

      expect(typeof res.body.data.accessToken).toBe('string');
      expect(refreshCookie(res)).toBeDefined();

      await api
        .post(`${API}/auth/refresh`)
        .set('Cookie', [`refreshToken=${otherSession}`])
        .expect(401);

      await customer.post('/auth/refresh').expect(200);

      await api
        .post(`${API}/auth/login`)
        .send({ username: customer.username, password: 'brandnewpass123' })
        .expect(200);
      await api
        .post(`${API}/auth/login`)
        .send({ username: customer.username, password: customer.password })
        .expect(401);
    });

    it('refuses to change another account', async () => {
      const customer = await registerBuyer('pwowner');
      const other = await registerBuyer('pwother');
      await customer
        .put(`/users/${other.id}/password`, {
          currentPassword: customer.password,
          newPassword: 'whatever123',
        })
        .expect(403);
    });
  });

  describe('DELETE /users/:id', () => {
    it('closes the account, scrubs the profile and keeps the orders', async () => {
      const admin = await createAdmin('closeadmin');
      const product = await createProduct(admin, { stock: 5, price: 10 });
      const customer = await registerBuyer('closer');

      const added = await customer.post('/cart', { productId: product.id, quantity: 2 }).expect(201);
      const checkout = await customer
        .post('/cart/checkout', { cartItemIds: [added.body.data.id], addressId: customer.addressId })
        .expect(201);
      const orderId = checkout.body.data.order.id;

      await customer.delete(`/users/${customer.id}`).expect(200);

      const closed = await users.show(customer.id);
      expect(closed).toBeNull();

      const stillThere = await orders.show(orderId);
      expect(stillThere?.userId).toBe(customer.id);

      await api
        .post(`${API}/auth/login`)
        .send({ username: customer.username, password: customer.password })
        .expect(401);

      await api
        .post(`${API}/auth/register`)
        .send({ username: customer.username, password: 'anotherpass123' })
        .expect(201);
    });
  });
});
