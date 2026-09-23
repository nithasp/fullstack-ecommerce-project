import { createAdmin, createProduct, registerBuyer } from '../support/api';

const VARIANTS = [
  { _id: 'black', color: 'Black', price: 20, stock: 4 },
  { _id: 'white', color: 'White', price: 25, stock: 2 },
];

describe('Cart endpoints', () => {
  describe('POST /cart', () => {
    it('adds an item and reads its price and shop from the product', async () => {
      const admin = await createAdmin('cartadmin');
      const product = await createProduct(admin, { price: 9.99, shopId: 'shop_1', shopName: 'Test Shop' });
      const customer = await registerBuyer('cartcustomer');

      const res = await customer
        .post('/cart', { productId: product.id, quantity: 2, productPrice: 0.01, shopName: 'Fake Shop' })
        .expect(201);

      expect(res.body.data.quantity).toBe(2);
      expect(res.body.data.productPrice).toBe('9.99');
      expect(res.body.data.shopName).toBe('Test Shop');
    });

    it('stores the option the product defines, not the one the request sends', async () => {
      const admin = await createAdmin('variantadmin');
      const product = await createProduct(admin, { price: 20, stock: 6, types: VARIANTS });
      const customer = await registerBuyer('variantcustomer');

      const res = await customer
        .post('/cart', {
          productId: product.id,
          quantity: 1,
          typeId: 'white',
          selectedType: { _id: 'white', color: 'White', price: 0.5, stock: 99 },
        })
        .expect(201);

      expect(res.body.data.selectedType.price).toBe(25);
      expect(res.body.data.typeId).toBe('white');
    });

    it('shows the option price the product has now, not the one it had when it was added', async () => {
      const admin = await createAdmin('repriceadmin');
      const product = await createProduct(admin, { price: 20, stock: 6, types: VARIANTS });
      const customer = await registerBuyer('repricecustomer');

      const added = await customer
        .post('/cart', { productId: product.id, quantity: 1, typeId: 'white' })
        .expect(201);
      expect(added.body.data.selectedType.price).toBe(25);

      await admin
        .patch(`/admin/products/${product.id}`, {
          types: VARIANTS.map((type) => (type._id === 'white' ? { ...type, price: 30 } : type)),
        })
        .expect(200);

      const cart = await customer.get('/cart').expect(200);
      expect(cart.body.data[0].selectedType.price).toBe(30);

      const paid = await customer
        .post('/cart/checkout', { cartItemIds: [added.body.data.id], addressId: customer.addressId })
        .expect(201);
      expect(paid.body.data.items[0].unitPrice).toBe('30.00');
      expect(paid.body.data.order.total).toBe('30.00');
    });

    it('needs an option chosen when the product has them', async () => {
      const admin = await createAdmin('mustpickadmin');
      const product = await createProduct(admin, { price: 20, stock: 6, types: VARIANTS });
      const customer = await registerBuyer('mustpickcustomer');

      const res = await customer.post('/cart', { productId: product.id, quantity: 1 }).expect(400);
      expect(res.body.message).toBe('Please choose an option');
    });

    it('adds to the quantity when the same product and option go in twice', async () => {
      const admin = await createAdmin('twiceadmin');
      const product = await createProduct(admin);
      const customer = await registerBuyer('twicecustomer');

      await customer.post('/cart', { productId: product.id, quantity: 2 }).expect(201);
      const second = await customer.post('/cart', { productId: product.id, quantity: 3 }).expect(201);

      expect(second.body.data.quantity).toBe(5);
      expect((await customer.get('/cart').expect(200)).body.data.length).toBe(1);
    });

    it('rejects a product that does not exist, an archived one, and an unknown option', async () => {
      const admin = await createAdmin('rejectadmin');
      const product = await createProduct(admin, { types: VARIANTS });
      const archived = await createProduct(admin);
      await admin.delete(`/admin/products/${archived.id}`).expect(200);
      const customer = await registerBuyer('rejectcustomer');

      const missing = await customer.post('/cart', { productId: 999999, quantity: 1 }).expect(400);
      expect(missing.body.message).toBe('Product does not exist');

      await customer.post('/cart', { productId: archived.id, quantity: 1 }).expect(400);
      await customer.post('/cart', { productId: product.id, quantity: 1, typeId: 'pink' }).expect(400);
    });

    it('rejects a quantity that is not a whole number above zero', async () => {
      const admin = await createAdmin('qtyadmin');
      const product = await createProduct(admin);
      const customer = await registerBuyer('qtycustomer');

      for (const quantity of [0, -1, 1.5, 'many', 1000]) {
        await customer.post('/cart', { productId: product.id, quantity }).expect(400);
      }
    });
  });

  describe('PATCH and DELETE /cart', () => {
    it('updates a quantity, removes an item and empties the cart', async () => {
      const admin = await createAdmin('editadmin');
      const product = await createProduct(admin);
      const other = await createProduct(admin);
      const customer = await registerBuyer('editcustomer');

      const added = await customer.post('/cart', { productId: product.id, quantity: 1 }).expect(201);
      const updated = await customer.patch(`/cart/${added.body.data.id}`, { quantity: 4 }).expect(200);
      expect(updated.body.data.quantity).toBe(4);

      await customer.delete(`/cart/${added.body.data.id}`).expect(200);
      expect((await customer.get('/cart').expect(200)).body.data.length).toBe(0);

      await customer.post('/cart', { productId: other.id, quantity: 1 }).expect(201);
      await customer.delete('/cart').expect(200);
      expect((await customer.get('/cart').expect(200)).body.data.length).toBe(0);
    });

    it('cannot touch a cart item that belongs to someone else', async () => {
      const admin = await createAdmin('theftadmin');
      const product = await createProduct(admin);
      const owner = await registerBuyer('cartowner');
      const thief = await registerBuyer('cartthief');

      const added = await owner.post('/cart', { productId: product.id, quantity: 1 }).expect(201);

      await thief.patch(`/cart/${added.body.data.id}`, { quantity: 9 }).expect(404);
      await thief.delete(`/cart/${added.body.data.id}`).expect(404);
    });
  });

  describe('POST /cart/checkout', () => {
    it('charges the cart quantities, keeps the price paid and takes the stock down', async () => {
      const admin = await createAdmin('checkoutadmin');
      const product = await createProduct(admin, { price: 10, stock: 5 });
      const customer = await registerBuyer('checkoutcustomer');

      const added = await customer.post('/cart', { productId: product.id, quantity: 2 }).expect(201);
      const res = await customer
        .post('/cart/checkout', { cartItemIds: [added.body.data.id], addressId: customer.addressId })
        .expect(201);

      expect(res.body.data.order.status).toBe('complete');
      expect(res.body.data.order.total).toBe('20.00');
      expect(res.body.data.items[0].unitPrice).toBe('10.00');
      expect(res.body.data.items[0].quantity).toBe(2);

      const afterwards = await admin.get(`/admin/products/${product.id}`).expect(200);
      expect(afterwards.body.data.stock).toBe(3);

      expect((await customer.get('/cart').expect(200)).body.data.length).toBe(0);
    });

    it('keeps the price the customer paid when the product price changes later', async () => {
      const admin = await createAdmin('pricechangeadmin');
      const product = await createProduct(admin, { price: 10, stock: 5 });
      const customer = await registerBuyer('pricechangecustomer');

      const added = await customer.post('/cart', { productId: product.id, quantity: 1 }).expect(201);
      const checkout = await customer
        .post('/cart/checkout', { cartItemIds: [added.body.data.id], addressId: customer.addressId })
        .expect(201);

      await admin.patch(`/admin/products/${product.id}`, { price: 99 }).expect(200);

      const order = await customer.get(`/orders/${checkout.body.data.order.id}`).expect(200);
      expect(order.body.data.total).toBe('10.00');
    });

    it('charges the price and stock of the chosen option', async () => {
      const admin = await createAdmin('variantcheckoutadmin');
      const product = await createProduct(admin, { price: 20, stock: 6, types: VARIANTS });
      const customer = await registerBuyer('variantcheckoutcustomer');

      const added = await customer
        .post('/cart', { productId: product.id, quantity: 2, typeId: 'white' })
        .expect(201);
      const res = await customer
        .post('/cart/checkout', { cartItemIds: [added.body.data.id], addressId: customer.addressId })
        .expect(201);

      expect(res.body.data.items[0].unitPrice).toBe('25.00');
      expect(res.body.data.items[0].typeId).toBe('white');
      expect(res.body.data.order.total).toBe('50.00');

      const afterwards = await admin.get(`/admin/products/${product.id}`).expect(200);
      expect(afterwards.body.data.stock).toBe(4);
      expect(afterwards.body.data.types.find((type: { _id: string }) => type._id === 'white').stock).toBe(0);
    });

    it('takes stock from the option that was bought and leaves the others alone', async () => {
      const admin = await createAdmin('drainadmin');
      const product = await createProduct(admin, { price: 20, stock: 6, types: VARIANTS });
      const customer = await registerBuyer('draincustomer');

      const added = await customer
        .post('/cart', { productId: product.id, quantity: 2, typeId: 'black' })
        .expect(201);
      await customer
        .post('/cart/checkout', { cartItemIds: [added.body.data.id], addressId: customer.addressId })
        .expect(201);

      const after = (await admin.get(`/admin/products/${product.id}`).expect(200)).body.data;
      const stockOf = (id: string) =>
        after.types.find((type: { _id: string }) => type._id === id).stock as number;

      expect(stockOf('black')).toBe(2);
      expect(stockOf('white')).toBe(2);
      expect(after.stock).toBe(stockOf('black') + stockOf('white'));
    });

    it('checks out only the items the customer picked', async () => {
      const admin = await createAdmin('partialadmin');
      const first = await createProduct(admin, { price: 5, stock: 5 });
      const second = await createProduct(admin, { price: 7, stock: 5 });
      const customer = await registerBuyer('partialcustomer');

      const keep = await customer.post('/cart', { productId: first.id, quantity: 1 }).expect(201);
      const buy = await customer.post('/cart', { productId: second.id, quantity: 1 }).expect(201);

      const res = await customer
        .post('/cart/checkout', { cartItemIds: [buy.body.data.id], addressId: customer.addressId })
        .expect(201);
      expect(res.body.data.items.length).toBe(1);

      const cart = await customer.get('/cart').expect(200);
      expect(cart.body.data.length).toBe(1);
      expect(cart.body.data[0].id).toBe(keep.body.data.id);
    });

    it('refuses when the stock is not there, and changes nothing', async () => {
      const admin = await createAdmin('stockadmin');
      const product = await createProduct(admin, { price: 10, stock: 3 });
      const customer = await registerBuyer('stockcustomer');

      const added = await customer.post('/cart', { productId: product.id, quantity: 3 }).expect(201);
      await admin.patch(`/admin/products/${product.id}`, { stock: 1 }).expect(200);

      const res = await customer
        .post('/cart/checkout', { cartItemIds: [added.body.data.id], addressId: customer.addressId })
        .expect(409);
      expect(res.body.message).toContain('Only 1 left');

      expect((await admin.get(`/admin/products/${product.id}`).expect(200)).body.data.stock).toBe(1);
      expect((await customer.get('/cart').expect(200)).body.data.length).toBe(1);
      expect((await customer.get('/orders').expect(200)).body.meta.total).toBe(0);
    });

    it('refuses when a product was archived while it sat in the cart', async () => {
      const admin = await createAdmin('goneadmin');
      const product = await createProduct(admin, { price: 10, stock: 5 });
      const customer = await registerBuyer('gonecustomer');

      const added = await customer.post('/cart', { productId: product.id, quantity: 1 }).expect(201);
      await admin.delete(`/admin/products/${product.id}`).expect(200);

      const res = await customer
        .post('/cart/checkout', { cartItemIds: [added.body.data.id], addressId: customer.addressId })
        .expect(409);
      expect(res.body.message).toBe('One of those products is no longer on sale');
    });

    it('refuses cart items that belong to someone else', async () => {
      const admin = await createAdmin('otheradmin');
      const product = await createProduct(admin);
      const owner = await registerBuyer('otherowner');
      const thief = await registerBuyer('otherthief');

      const added = await owner.post('/cart', { productId: product.id, quantity: 1 }).expect(201);
      await thief
        .post('/cart/checkout', { cartItemIds: [added.body.data.id], addressId: thief.addressId })
        .expect(409);
    });

    it('keeps the address the order was shipped to, even after it is changed or deleted', async () => {
      const admin = await createAdmin('shipadmin');
      const product = await createProduct(admin, { price: 10, stock: 5 });
      const customer = await registerBuyer('shipcustomer');

      const added = await customer.post('/cart', { productId: product.id, quantity: 1 }).expect(201);
      const placed = await customer
        .post('/cart/checkout', { cartItemIds: [added.body.data.id], addressId: customer.addressId })
        .expect(201);

      expect(placed.body.data.order.addressId).toBe(customer.addressId);
      expect(placed.body.data.order.shippingAddress).toEqual({
        fullName: 'Test Buyer',
        phone: null,
        address: '1 Test Street',
        city: 'Testville',
        label: 'home',
      });

      await customer.patch(`/addresses/${customer.addressId}`, { city: 'Somewhere Else' }).expect(200);
      await customer.delete(`/addresses/${customer.addressId}`).expect(200);

      const order = await customer.get(`/orders/${placed.body.data.order.id}`).expect(200);
      expect(order.body.data.shippingAddress.city).toBe('Testville');
      expect(order.body.data.addressId).toBeNull();
    });

    it('refuses an address that belongs to someone else, or none at all', async () => {
      const admin = await createAdmin('shipguardadmin');
      const product = await createProduct(admin, { price: 10, stock: 5 });
      const customer = await registerBuyer('shipguardcustomer');
      const stranger = await registerBuyer('shipguardstranger');

      const added = await customer.post('/cart', { productId: product.id, quantity: 1 }).expect(201);

      const borrowed = await customer
        .post('/cart/checkout', { cartItemIds: [added.body.data.id], addressId: stranger.addressId })
        .expect(404);
      expect(borrowed.body.message).toBe('That shipping address was not found');

      const missing = await customer
        .post('/cart/checkout', { cartItemIds: [added.body.data.id] })
        .expect(400);
      expect(missing.body.message).toContain('addressId');

      expect((await customer.get('/cart').expect(200)).body.data.length).toBe(1);
    });

    it('needs at least one cart item', async () => {
      const customer = await registerBuyer('emptycheckout');
      const res = await customer
        .post('/cart/checkout', { cartItemIds: [], addressId: customer.addressId })
        .expect(400);
      expect(res.body.message).toBe('cartItemIds must hold at least one cart item');
    });
  });
});
