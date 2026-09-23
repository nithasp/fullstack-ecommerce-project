import pool from '../../database';
import { CartRepository } from '../../repositories/cart.repository';
import { ProductRepository } from '../../repositories/product.repository';
import { UserRepository } from '../../repositories/user.repository';
import { CURRENT_PASSWORD_VERSION, hashPassword } from '../../services/password.service';
import { createAdmin, createProduct, registerCustomer, uniqueName } from '../support/api';

const users = new UserRepository();
const products = new ProductRepository();
const carts = new CartRepository();

async function makeUser(prefix = 'repo') {
  return users.create({
    firstName: 'Repo',
    lastName: 'User',
    username: uniqueName(prefix),
    passwordHash: await hashPassword('repopass123'),
    passwordVersion: CURRENT_PASSWORD_VERSION,
  });
}

describe('Repositories', () => {
  describe('users', () => {
    it('finds an account whatever case the username is written in', async () => {
      const user = await makeUser('caseuser');
      expect((await users.findByUsername(user.username.toUpperCase()))?.id).toBe(user.id);
    });

    it('scrubs an account when it is closed and hides it from every read', async () => {
      const user = await makeUser('closeuser');
      const closed = await users.anonymise(user.id);

      expect(closed?.username).toBe(user.username);
      expect(await users.show(user.id)).toBeNull();
      expect(await users.findByUsername(user.username)).toBeNull();
      expect(await users.findCredentials(user.username)).toBeNull();

      const { rows } = await pool.query(
        'SELECT first_name, username, password, deleted_at FROM users WHERE id = $1',
        [user.id],
      );
      expect(rows[0].first_name).toBe('Deleted');
      expect(rows[0].username).not.toBe(user.username);
      expect(rows[0].password).toBe('');
      expect(rows[0].deleted_at).not.toBeNull();
    });

    it('closes an account only once', async () => {
      const user = await makeUser('twiceuser');
      expect(await users.anonymise(user.id)).not.toBeNull();
      expect(await users.anonymise(user.id)).toBeNull();
    });
  });

  describe('timestamps', () => {
    it('come back as the moment they were written', async () => {
      const admin = await createAdmin('timerepo');
      const product = await createProduct(admin);
      const customer = await registerCustomer('timerepocustomer');

      const before = Date.now();
      await customer.post('/cart', { productId: product.id, quantity: 1 }).expect(201);

      const [item] = await carts.listByUser(customer.id);
      const written = new Date(item.createdAt).getTime();

      expect(written).toBeGreaterThan(before - 60_000);
      expect(written).toBeLessThan(Date.now() + 60_000);
    });
  });

  describe('products', () => {
    it('reads a row back with the shape the API promises', async () => {
      const admin = await createAdmin('shaperepo');
      const created = await createProduct(admin, {
        price: 5.5,
        types: [{ _id: 'x', color: 'Red', price: 5.5, stock: 2 }],
      });

      const product = await products.show(created.id);
      expect(typeof product?.price).toBe('string');
      expect(product?.types[0].price).toBe(5.5);
      expect(Array.isArray(product?.reviews)).toBe(true);
      expect(product?.isActive).toBe(true);
    });

    it('keeps an archived product readable for the orders that point at it', async () => {
      const admin = await createAdmin('archiverepo');
      const created = await createProduct(admin);

      await products.archive(created.id);
      expect(await products.show(created.id)).toBeNull();
      expect((await products.show(created.id, true))?.isActive).toBe(false);
    });
  });

  describe('cart', () => {
    it('caps the quantity when the same product is added again and again', async () => {
      const admin = await createAdmin('caprepo');
      const product = await createProduct(admin);
      const customer = await registerCustomer('capcustomer');

      for (let i = 0; i < 3; i++) {
        await carts.upsert(
          customer.id,
          { productId: product.id, quantity: 900, typeId: null },
          { shopId: null, shopName: null },
          null,
        );
      }

      const [item] = await carts.listByUser(customer.id);
      expect(item.quantity).toBe(999);
    });
  });
});
