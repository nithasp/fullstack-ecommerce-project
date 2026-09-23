import { api, API } from '../support/api';

describe('App', () => {
  it('answers the health check', async () => {
    const res = await api.get('/').expect(200);
    expect(res.body.message).toBe('Storefront API is running!');
  });

  it('answers an unknown route with a JSON 404 in the envelope', async () => {
    const res = await api.get(`${API}/no-such-route`).expect(404);
    expect(res.body).toEqual({
      status: 404,
      message: `Route GET ${API}/no-such-route not found`,
      data: null,
      code: 'not_found',
    });
  });

  it('serves the API only under /api/v1', async () => {
    await api.post('/auth/login').send({ username: 'anyone', password: 'anything' }).expect(404);
  });

  it('gives every response a request id', async () => {
    const res = await api.get('/').expect(200);
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('serves the API reference and the files it loads', async () => {
    await api.get('/docs').expect(200);

    const theme = await api.get('/docs/theme.css').expect(200);
    expect(theme.headers['content-type']).toContain('text/css');
    expect(theme.text).toContain('.swagger-ui');

    await api.get('/docs/init.js').expect(200);
    expect((await api.get('/openapi.yaml').expect(200)).text).toContain('openapi:');
  });

  it('rejects a body that is not valid JSON', async () => {
    const res = await api
      .post(`${API}/auth/login`)
      .set('Content-Type', 'application/json')
      .send('{"username":')
      .expect(400);
    expect(res.body.message).toBe('Request body must be valid JSON');
  });
});
