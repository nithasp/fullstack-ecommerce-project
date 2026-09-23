import { registerCustomer } from '../support/api';

const FORM = { fullName: 'Ada Lovelace', address: '12 Analytical Way', city: 'London', phone: '0700000000' };

describe('Address endpoints', () => {
  it('makes the first address the default one', async () => {
    const customer = await registerCustomer('firstaddress');
    const res = await customer.post('/addresses', FORM).expect(201);

    expect(res.body.data.isDefault).toBe(true);
    expect(res.body.data.label).toBe('home');
  });

  it('moves the default when another address claims it', async () => {
    const customer = await registerCustomer('defaultmover');
    const first = await customer.post('/addresses', FORM).expect(201);
    const second = await customer.post('/addresses', { ...FORM, city: 'Paris', isDefault: true }).expect(201);

    const list = await customer.get('/addresses').expect(200);
    const byId = new Map(
      list.body.data.map((address: { id: number; isDefault: boolean }) => [address.id, address.isDefault]),
    );

    expect(byId.get(second.body.data.id)).toBe(true);
    expect(byId.get(first.body.data.id)).toBe(false);
  });

  it('keeps exactly one default when the current one is deleted', async () => {
    const customer = await registerCustomer('defaultdeleter');
    const first = await customer.post('/addresses', FORM).expect(201);
    await customer.post('/addresses', { ...FORM, city: 'Berlin' }).expect(201);

    await customer.delete(`/addresses/${first.body.data.id}`).expect(200);

    const list = await customer.get('/addresses').expect(200);
    expect(list.body.data.filter((address: { isDefault: boolean }) => address.isDefault).length).toBe(1);
  });

  it('leaves the default alone when the update is for an address that is not there', async () => {
    const customer = await registerCustomer('failedupdate');
    const mine = await customer.post('/addresses', FORM).expect(201);

    await customer.patch('/addresses/999999', { isDefault: true }).expect(404);

    const list = await customer.get('/addresses').expect(200);
    expect(list.body.data[0].id).toBe(mine.body.data.id);
    expect(list.body.data[0].isDefault).toBe(true);
  });

  it('leaves the default alone when the address belongs to someone else', async () => {
    const owner = await registerCustomer('addressowner');
    const stranger = await registerCustomer('addressstranger');

    const theirs = await owner.post('/addresses', FORM).expect(201);
    const mine = await stranger.post('/addresses', { ...FORM, city: 'Rome' }).expect(201);

    await stranger.patch(`/addresses/${theirs.body.data.id}`, { isDefault: true }).expect(404);

    expect((await stranger.get(`/addresses/${mine.body.data.id}`).expect(200)).body.data.isDefault).toBe(
      true,
    );
    expect((await owner.get(`/addresses/${theirs.body.data.id}`).expect(200)).body.data.isDefault).toBe(true);
  });

  it('updates fields and needs at least one of them', async () => {
    const customer = await registerCustomer('addresspatcher');
    const created = await customer.post('/addresses', FORM).expect(201);

    const updated = await customer
      .patch(`/addresses/${created.body.data.id}`, { city: 'Oxford' })
      .expect(200);
    expect(updated.body.data.city).toBe('Oxford');
    expect(updated.body.data.fullName).toBe(FORM.fullName);

    const empty = await customer.patch(`/addresses/${created.body.data.id}`, {}).expect(400);
    expect(empty.body.message).toBe('at least one field is required to update');
  });

  it('checks the fields it is given', async () => {
    const customer = await registerCustomer('addressvalidator');

    await customer.post('/addresses', { ...FORM, fullName: '' }).expect(400);
    await customer.post('/addresses', { ...FORM, city: undefined }).expect(400);

    const label = await customer.post('/addresses', { ...FORM, label: 'castle' }).expect(400);
    expect(label.body.message).toBe('label must be one of: home, work, other');
  });

  it('shows and deletes only the caller own addresses', async () => {
    const owner = await registerCustomer('addressreader');
    const stranger = await registerCustomer('addresspeeker');
    const created = await owner.post('/addresses', FORM).expect(201);

    await stranger.get(`/addresses/${created.body.data.id}`).expect(404);
    await stranger.delete(`/addresses/${created.body.data.id}`).expect(404);
    expect((await owner.get('/addresses').expect(200)).body.data.length).toBe(1);
  });
});
