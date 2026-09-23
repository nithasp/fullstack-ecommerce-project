import { createAdmin, createProduct, registerBuyer } from '../support/api';

async function placeOrder(
  customer: Awaited<ReturnType<typeof registerBuyer>>,
  productId: number,
  quantity = 1,
) {
  const added = await customer.post('/cart', { productId, quantity }).expect(201);
  const res = await customer
    .post('/cart/checkout', { cartItemIds: [added.body.data.id], addressId: customer.addressId })
    .expect(201);
  return res.body.data.order as { id: number; total: string; createdAt: string; status: string };
}

describe('Order endpoints', () => {
  it('lists only the orders of the customer asking', async () => {
    const admin = await createAdmin('orderadmin');
    const product = await createProduct(admin, { price: 8, stock: 10 });
    const customer = await registerBuyer('ordercustomer');
    const other = await registerBuyer('orderother');

    await placeOrder(customer, product.id, 2);
    await placeOrder(other, product.id, 1);

    const res = await customer.get('/orders').expect(200);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0].total).toBe('16.00');
    expect(res.body.data[0].status).toBe('complete');
  });

  it('stamps the order with the time it was placed', async () => {
    const admin = await createAdmin('timeadmin');
    const product = await createProduct(admin, { stock: 5 });
    const customer = await registerBuyer('timecustomer');

    const order = await placeOrder(customer, product.id);
    const placedAt = new Date(order.createdAt).getTime();

    expect(Math.abs(Date.now() - placedAt)).toBeLessThan(60_000);
  });

  it('answers 404 for an order that belongs to someone else', async () => {
    const admin = await createAdmin('privateadmin');
    const product = await createProduct(admin, { stock: 5 });
    const owner = await registerBuyer('orderowner');
    const stranger = await registerBuyer('orderstranger');

    const order = await placeOrder(owner, product.id);

    await stranger.get(`/orders/${order.id}`).expect(404);
    await stranger.get(`/orders/${order.id}/products`).expect(404);
  });

  it('returns the lines of an order with the price paid', async () => {
    const admin = await createAdmin('lineadmin');
    const product = await createProduct(admin, { price: 12.5, stock: 5 });
    const customer = await registerBuyer('linecustomer');

    const order = await placeOrder(customer, product.id, 2);
    const res = await customer.get(`/orders/${order.id}/products`).expect(200);

    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].unitPrice).toBe('12.50');
    expect(res.body.data[0].quantity).toBe(2);
  });

  it('filters by status', async () => {
    const admin = await createAdmin('statusadmin');
    const product = await createProduct(admin, { stock: 5 });
    const customer = await registerBuyer('statuscustomer');
    await placeOrder(customer, product.id);

    expect((await customer.get('/orders?status=complete').expect(200)).body.meta.total).toBe(1);
    expect((await customer.get('/orders?status=active').expect(200)).body.meta.total).toBe(0);

    const bad = await customer.get('/orders?status=shipped').expect(400);
    expect(bad.body.message).toBe('status must be one of: active, complete');
  });

  it('has no customer routes that write to an order', async () => {
    const admin = await createAdmin('readonlyadmin');
    const product = await createProduct(admin, { stock: 5 });
    const customer = await registerBuyer('readonlycustomer');
    const order = await placeOrder(customer, product.id);

    await customer.post('/orders', { userId: customer.id, status: 'complete' }).expect(404);
    await customer.patch(`/orders/${order.id}`, { status: 'active' }).expect(404);
    await customer.put(`/orders/${order.id}`, { status: 'active' }).expect(404);
    await customer.delete(`/orders/${order.id}`).expect(404);
    await customer.post(`/orders/${order.id}/products`, { productId: product.id, quantity: 1 }).expect(404);
  });

  it('counts only completed orders towards the popular list', async () => {
    const admin = await createAdmin('popularadmin');
    const quiet = await createProduct(admin, { stock: 100 });
    const loud = await createProduct(admin, { stock: 100 });
    const customer = await registerBuyer('popularcustomer');

    const active = await admin.post('/admin/orders', { userId: customer.id, status: 'active' }).expect(201);
    await admin
      .post(`/admin/orders/${active.body.data.id}/products`, { productId: quiet.id, quantity: 50 })
      .expect(201);

    await placeOrder(customer, loud.id, 3);

    const popular = await customer.get('/products/popular').expect(200);
    const ids = popular.body.data.map((product: { id: number }) => product.id);
    expect(ids.indexOf(loud.id)).toBeLessThan(
      ids.indexOf(quiet.id) === -1 ? ids.length : ids.indexOf(quiet.id),
    );
  });
});
