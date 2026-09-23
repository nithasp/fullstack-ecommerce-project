import { flushAuditLog } from '../../services/audit.service';
import { AuditRow } from '../../types/test.types';
import { api, API, createAdmin, createProduct, registerCustomer, uniqueName } from '../support/api';

async function auditRows(admin: Awaited<ReturnType<typeof createAdmin>>, query = ''): Promise<AuditRow[]> {
  await flushAuditLog();
  const res = await admin.get(`/admin/audit-logs?limit=100${query}`).expect(200);
  return res.body.data as AuditRow[];
}

describe('Activity trail', () => {
  it('records a write with the event the audit rules name', async () => {
    const admin = await createAdmin('auditadmin');
    const product = await createProduct(admin, { stock: 5 });
    const customer = await registerCustomer('auditcustomer');

    await customer.post('/cart', { productId: product.id, quantity: 2 }).expect(201);

    const rows = await auditRows(admin, `&userId=${customer.id}`);
    const added = rows.find((row) => row.event === 'cart.item_added');

    expect(added).toBeDefined();
    expect(added?.action).toBe('CREATE');
    expect(added?.statusCode).toBe(201);
    expect(added?.details).toEqual({ productId: product.id, quantity: 2 });
  });

  it('does not record a customer reading the catalog', async () => {
    const admin = await createAdmin('readadmin');
    const product = await createProduct(admin);
    const customer = await registerCustomer('readcustomer');

    await customer.get('/products').expect(200);
    await customer.get(`/products/${product.id}`).expect(200);
    await customer.get('/cart').expect(200);

    const rows = await auditRows(admin, `&userId=${customer.id}`);
    expect(rows.filter((row) => row.action === 'READ')).toEqual([]);
    expect(rows.map((row) => row.event)).toEqual(['user.registered']);
  });

  it('records an admin reading someone account data', async () => {
    const admin = await createAdmin('peekadmin');
    const customer = await registerCustomer('peeked');

    await admin.get(`/admin/users/${customer.id}`).expect(200);

    const rows = await auditRows(admin, `&userId=${admin.id}&action=READ`);
    expect(rows.some((row) => row.event === 'admin.user_viewed')).toBe(true);
  });

  it('records a failed login with the username that was tried and no password', async () => {
    const admin = await createAdmin('failadmin');
    const customer = await registerCustomer('failcustomer');

    await api
      .post(`${API}/auth/login`)
      .send({ username: customer.username, password: 'wrong-password' })
      .expect(401);

    const rows = await auditRows(admin, `&action=LOGIN_FAILED&username=${customer.username}`);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].event).toBe('user.login_failed');
    expect(JSON.stringify(rows[0])).not.toContain('wrong-password');
  });

  it('filters by action, result and time', async () => {
    const admin = await createAdmin('filteraudit');
    const customer = await registerCustomer('filteredcustomer');
    await customer.post('/cart', { productId: 999999, quantity: 1 }).expect(400);

    const failures = await auditRows(admin, `&userId=${customer.id}&result=failure`);
    expect(failures.every((row) => row.statusCode >= 400)).toBe(true);

    const successes = await auditRows(admin, `&userId=${customer.id}&result=success`);
    expect(successes.map((row) => row.event)).toEqual(['user.registered']);

    const future = new Date(Date.now() + 60_000).toISOString();
    expect((await auditRows(admin, `&userId=${customer.id}&from=${future}`)).length).toBe(0);

    const bad = await admin.get('/admin/audit-logs?action=SNOOPING').expect(400);
    expect(bad.body.message).toContain('action must be one or more of');
  });

  it('keeps page views out of the audit log and in their own list', async () => {
    const admin = await createAdmin('pageadmin');
    const customer = await registerCustomer('pagecustomer');
    const path = `/products/${uniqueName('p')}`;

    await customer.post('/page-views', { path, page: 'Product detail' }).expect(201);

    const rows = await auditRows(admin, `&userId=${customer.id}`);
    expect(rows.map((row) => row.event)).toEqual(['user.registered']);

    const views = await admin.get(`/admin/page-views?userId=${customer.id}`).expect(200);
    expect(views.body.meta.total).toBe(1);
    expect(views.body.data[0].path).toBe(path);
    expect(views.body.data[0].page).toBe('Product detail');
    expect(views.body.data[0].username).toBe(customer.username);
  });

  it('checks the page path it is given', async () => {
    const customer = await registerCustomer('pathcustomer');

    await customer.post('/page-views', { path: 'products' }).expect(400);
    await customer.post('/page-views', { path: '/products?q=1' }).expect(400);
    await customer.post('/page-views', { path: '' }).expect(400);
    await customer.post('/page-views', { path: `/${'x'.repeat(300)}` }).expect(400);
  });

  it('lets only an admin read the trail', async () => {
    const customer = await registerCustomer('nosy');
    await customer.get('/admin/audit-logs').expect(403);
    await customer.get('/admin/page-views').expect(403);
  });
});
