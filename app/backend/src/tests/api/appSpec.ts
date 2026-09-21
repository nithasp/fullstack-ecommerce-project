import supertest from 'supertest';
import app from '../../app';

const request = supertest(app);

describe('App', () => {
  it('GET / should answer the health check', async () => {
    const res = await request.get('/').expect(200);
    expect(res.body.message).toBe('Storefront API is running!');
  });

  it('should answer an unknown route with a JSON 404 in the envelope', async () => {
    const res = await request.get('/api/v1/no-such-route').expect(404);
    expect(res.body).toEqual({ status: 404, message: 'Route GET /api/v1/no-such-route not found', data: null });
  });

  it('should serve the API only under /api/v1', async () => {
    await request.post('/auth/login').send({ username: 'anyone', password: 'anything' }).expect(404);
  });
});
