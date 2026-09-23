import { createAdmin, createProduct, registerCustomer, uniqueName } from '../support/api';

describe('Product endpoints', () => {
  describe('catalog', () => {
    it('returns a page of products with the total', async () => {
      const admin = await createAdmin('catalogadmin');
      await createProduct(admin);
      const customer = await registerCustomer('shopper');

      const res = await customer.get('/products?limit=5').expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta.limit).toBe(5);
      expect(res.body.meta.total).toBeGreaterThan(0);
    });

    it('returns the price as a string, so no decimal is lost on the way', async () => {
      const admin = await createAdmin('priceadmin');
      const product = await createProduct(admin, { price: 12.34 });
      const customer = await registerCustomer('pricecustomer');

      const res = await customer.get(`/products/${product.id}`).expect(200);
      expect(res.body.data.price).toBe('12.34');
    });

    it('hides archived products from customers but keeps them for admins', async () => {
      const admin = await createAdmin('archiveadmin');
      const product = await createProduct(admin, { category: uniqueName('Archived') });
      const customer = await registerCustomer('archivecustomer');

      await customer.get(`/products/${product.id}`).expect(200);

      const archived = await admin.delete(`/admin/products/${product.id}`).expect(200);
      expect(archived.body.data.isActive).toBe(false);

      await customer.get(`/products/${product.id}`).expect(404);

      const catalog = await customer.get(`/products?category=${product.category}`).expect(200);
      expect(catalog.body.data.length).toBe(0);

      const adminList = await admin.get(`/admin/products?category=${product.category}`).expect(200);
      expect(adminList.body.data.length).toBe(1);
    });

    it('filters by category and search term', async () => {
      const admin = await createAdmin('filteradmin');
      const category = uniqueName('Cat');
      const name = uniqueName('Telescope');
      await createProduct(admin, { name, category });
      const customer = await registerCustomer('filtercustomer');

      const byCategory = await customer.get(`/products?category=${category}`).expect(200);
      expect(byCategory.body.data.length).toBe(1);

      const bySearch = await customer.get(`/products?search=${name.toLowerCase()}`).expect(200);
      expect(bySearch.body.data[0].name).toBe(name);
    });

    it('lists only the categories of active products', async () => {
      const admin = await createAdmin('catadmin');
      const category = uniqueName('OnlyCat');
      const product = await createProduct(admin, { category });
      const customer = await registerCustomer('catcustomer');

      expect((await customer.get('/products/categories').expect(200)).body.data).toContain(category);

      await admin.delete(`/admin/products/${product.id}`).expect(200);
      expect((await customer.get('/products/categories').expect(200)).body.data).not.toContain(category);
    });

    it('needs a token', async () => {
      const customer = await registerCustomer('tokenless');
      await customer.agent.get('/api/v1/products').expect(401);
    });
  });

  describe('POST /admin/products', () => {
    it('refuses a customer', async () => {
      const customer = await registerCustomer('notadmin');
      await customer.post('/admin/products', { name: 'Nope', price: 1 }).expect(403);
    });

    it('stores the product an admin sends', async () => {
      const admin = await createAdmin('creator');
      const res = await admin
        .post('/admin/products', {
          name: 'Field Notebook',
          price: '4.50',
          category: 'Stationery',
          stock: 12,
          types: [{ _id: 'red', color: 'Red', price: 4.5, stock: 12 }],
        })
        .expect(201);

      expect(res.body.data.price).toBe('4.50');
      expect(res.body.data.types[0].color).toBe('Red');
      expect(res.body.data.isActive).toBe(true);
    });

    it('rejects a price that is not an amount', async () => {
      const admin = await createAdmin('badprice');
      for (const price of ['', 'free', true, 19.999, -1]) {
        const res = await admin.post('/admin/products', { name: 'Bad', price }).expect(400);
        expect(res.body.message).toContain('price');
      }
    });

    it('rejects options that are not a list of options', async () => {
      const admin = await createAdmin('badtypes');
      for (const types of ['oops', {}, [null], [{ color: 'Red' }]]) {
        await admin.post('/admin/products', { name: 'Bad', price: 1, types }).expect(400);
      }
    });

    it('rejects a negative stock', async () => {
      const admin = await createAdmin('badstock');
      await admin.post('/admin/products', { name: 'Bad', price: 1, stock: -5 }).expect(400);
    });

    it('creates many products at once', async () => {
      const admin = await createAdmin('bulk');
      const res = await admin
        .post('/admin/products/bulk', [
          { name: uniqueName('Bulk'), price: 1.5 },
          { name: uniqueName('Bulk'), price: 2.5 },
        ])
        .expect(201);

      expect(res.body.data.length).toBe(2);
      expect(res.body.message).toBe('2 products created.');
    });

    it('rejects a bulk import where one product is wrong, without saving any of them', async () => {
      const admin = await createAdmin('bulkbad');
      const name = uniqueName('BulkBad');
      await admin
        .post('/admin/products/bulk', [
          { name, price: 1.5 },
          { name: uniqueName('BulkBad'), price: 'free' },
        ])
        .expect(400);

      const list = await admin.get(`/admin/products?search=${name}`).expect(200);
      expect(list.body.data.length).toBe(0);
    });
  });

  describe('PATCH /admin/products/:id', () => {
    it('changes only the fields it is given', async () => {
      const admin = await createAdmin('patcher');
      const product = await createProduct(admin, { price: 10, stock: 3 });

      const res = await admin.patch(`/admin/products/${product.id}`, { price: 11.5 }).expect(200);
      expect(res.body.data.price).toBe('11.50');
      expect(res.body.data.stock).toBe(3);
    });

    it('needs at least one field', async () => {
      const admin = await createAdmin('emptypatch');
      const product = await createProduct(admin);
      await admin.patch(`/admin/products/${product.id}`, {}).expect(400);
    });

    it('can put an archived product back on sale', async () => {
      const admin = await createAdmin('restorer');
      const product = await createProduct(admin);

      await admin.delete(`/admin/products/${product.id}`).expect(200);
      const res = await admin.patch(`/admin/products/${product.id}`, { isActive: true }).expect(200);
      expect(res.body.data.isActive).toBe(true);
    });

    it('answers 404 for a product that does not exist', async () => {
      const admin = await createAdmin('missing');
      await admin.patch('/admin/products/999999', { price: 1 }).expect(404);
      await admin.get('/admin/products/999999').expect(404);
    });
  });
});
