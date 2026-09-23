import { UserRepository } from '../../repositories/user.repository';
import {
  api,
  API,
  cookieValue,
  createAdmin,
  createProduct,
  refreshCookie,
  registerCustomer,
  uniqueName,
} from '../support/api';

const users = new UserRepository();

describe('Admin endpoints', () => {
  describe('the guard', () => {
    it('refuses a customer and needs a token', async () => {
      const customer = await registerCustomer('guarded');
      const res = await customer.get('/admin/users').expect(403);
      expect(res.body).toEqual({
        status: 403,
        message: 'Admin access required',
        data: null,
        code: 'forbidden',
      });

      await api.get(`${API}/admin/users`).expect(401);
    });

    it('drops a demoted admin straight away, without waiting for the token to expire', async () => {
      const admin = await createAdmin('demoted');
      await admin.get('/admin/users').expect(200);

      await users.updateRole(admin.id, 'customer');
      await admin.get('/admin/users').expect(403);
    });

    it('drops an admin whose account was closed', async () => {
      const admin = await createAdmin('closedadmin');
      const other = await createAdmin('closer');

      await other.delete(`/admin/users/${admin.id}`).expect(200);
      await admin.get('/admin/users').expect(401);
    });
  });

  describe('users', () => {
    it('creates an account with a role and lists it', async () => {
      const admin = await createAdmin('usercreator');
      const username = uniqueName('made');

      const created = await admin
        .post('/admin/users', {
          firstName: 'Made',
          lastName: 'ByAdmin',
          username,
          password: 'createdpass123',
          role: 'admin',
        })
        .expect(201);
      expect(created.body.data.role).toBe('admin');

      const read = await admin.get(`/admin/users/${created.body.data.id}`).expect(200);
      expect(read.body.data.username).toBe(username);

      const list = await admin.get('/admin/users?limit=1').expect(200);
      expect(list.body.data.length).toBe(1);
      expect(list.body.meta.total).toBeGreaterThan(0);
    });

    it('refuses a duplicate username', async () => {
      const admin = await createAdmin('dupemaker');
      const customer = await registerCustomer('dupetarget');

      await admin
        .post('/admin/users', {
          firstName: 'A',
          lastName: 'B',
          username: customer.username,
          password: 'anotherpass123',
        })
        .expect(409);
    });

    it('resets a password and signs that account out everywhere', async () => {
      const admin = await createAdmin('resetter');
      const customer = await registerCustomer('resettee');

      await admin.put(`/admin/users/${customer.id}/password`, { newPassword: 'freshpass123' }).expect(200);

      await customer.post('/auth/refresh').expect(401);
      await api
        .post(`${API}/auth/login`)
        .send({ username: customer.username, password: 'freshpass123' })
        .expect(200);
    });

    it('changes a role, ends that session and refuses to change its own', async () => {
      const admin = await createAdmin('promoter');
      const customer = await registerCustomer('promotee');

      const res = await admin.put(`/admin/users/${customer.id}/role`, { role: 'admin' }).expect(200);
      expect(res.body.data.role).toBe('admin');
      await customer.post('/auth/refresh').expect(401);

      const own = await admin.put(`/admin/users/${admin.id}/role`, { role: 'customer' }).expect(400);
      expect(own.body.message).toBe('You cannot change your own role');
    });

    it('will not close its own account', async () => {
      const admin = await createAdmin('selfcloser');
      await admin.delete(`/admin/users/${admin.id}`).expect(400);
    });

    it('rejects an unknown role', async () => {
      const admin = await createAdmin('badrole');
      const customer = await registerCustomer('badroletarget');
      const res = await admin.put(`/admin/users/${customer.id}/role`, { role: 'superuser' }).expect(400);
      expect(res.body.message).toBe('role must be one of: customer, admin');
    });
  });

  describe('orders', () => {
    it('creates, updates, reads and deletes any order', async () => {
      const admin = await createAdmin('ordermanager');
      const product = await createProduct(admin, { price: 3, stock: 10 });
      const customer = await registerCustomer('ordersubject');

      const created = await admin.post('/admin/orders', { userId: customer.id }).expect(201);
      const orderId = created.body.data.id;
      expect(created.body.data.status).toBe('active');

      const line = await admin
        .post(`/admin/orders/${orderId}/products`, { productId: product.id, quantity: 4 })
        .expect(201);
      expect(line.body.data.unitPrice).toBe('3.00');

      const updated = await admin.patch(`/admin/orders/${orderId}`, { status: 'complete' }).expect(200);
      expect(updated.body.data.status).toBe('complete');
      expect(updated.body.data.total).toBe('12.00');

      const forCustomer = await admin.get(`/admin/orders?userId=${customer.id}`).expect(200);
      expect(forCustomer.body.meta.total).toBe(1);

      await admin.delete(`/admin/orders/${orderId}`).expect(200);
      await admin.get(`/admin/orders/${orderId}`).expect(404);
    });

    it('refuses an order for an account that does not exist', async () => {
      const admin = await createAdmin('ghostorder');
      await admin.post('/admin/orders', { userId: 999999 }).expect(404);
    });
  });

  describe('carts and addresses', () => {
    it('reads and edits the cart of any account', async () => {
      const admin = await createAdmin('cartmanager');
      const product = await createProduct(admin);
      const customer = await registerCustomer('cartsubject');

      const added = await admin
        .post(`/admin/carts/${customer.id}`, { productId: product.id, quantity: 2 })
        .expect(201);

      const asCustomer = await customer.get('/cart').expect(200);
      expect(asCustomer.body.data.length).toBe(1);

      await admin.patch(`/admin/cart-items/${added.body.data.id}`, { quantity: 5 }).expect(200);
      expect(
        (await admin.get(`/admin/cart-items/${added.body.data.id}`).expect(200)).body.data.quantity,
      ).toBe(5);

      await admin.delete(`/admin/carts/${customer.id}`).expect(200);
      expect((await customer.get('/cart').expect(200)).body.data.length).toBe(0);
    });

    it('manages addresses for any account', async () => {
      const admin = await createAdmin('addressmanager');
      const customer = await registerCustomer('addresssubject');

      const created = await admin
        .post('/admin/addresses', {
          userId: customer.id,
          fullName: 'Grace Hopper',
          address: '1 Navy Yard',
          city: 'Arlington',
        })
        .expect(201);
      expect(created.body.data.isDefault).toBe(true);

      await admin.patch(`/admin/addresses/${created.body.data.id}`, { city: 'Washington' }).expect(200);
      const read = await admin.get(`/admin/addresses/${created.body.data.id}`).expect(200);
      expect(read.body.data.city).toBe('Washington');

      await admin.delete(`/admin/addresses/${created.body.data.id}`).expect(200);
      expect((await customer.get('/addresses').expect(200)).body.data.length).toBe(0);
    });
  });

  describe('sessions of other accounts', () => {
    it('keeps the admin signed in after managing an account', async () => {
      const admin = await createAdmin('stayer');
      const customer = await registerCustomer('managed');

      await admin.put(`/admin/users/${customer.id}/password`, { newPassword: 'newpass12345' }).expect(200);

      const refreshed = await admin.post('/auth/refresh').expect(200);
      expect(cookieValue(refreshCookie(refreshed) as string).length).toBeGreaterThan(0);
    });
  });
});
