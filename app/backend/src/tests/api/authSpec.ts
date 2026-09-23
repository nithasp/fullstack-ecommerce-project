import { api, API, cookieValue, refreshCookie, registerCustomer, uniqueName } from '../support/api';

describe('Auth endpoints', () => {
  describe('POST /auth/register', () => {
    it('creates a customer and returns an access token', async () => {
      const username = uniqueName('newcustomer');
      const res = await api
        .post(`${API}/auth/register`)
        .send({ username, password: 'goodpass123' })
        .expect(201);

      expect(res.body.data.user.username).toBe(username);
      expect(res.body.data.user.role).toBe('customer');
      expect(typeof res.body.data.accessToken).toBe('string');
    });

    it('keeps the refresh token out of the body and in an HttpOnly cookie', async () => {
      const res = await api
        .post(`${API}/auth/register`)
        .send({ username: uniqueName('cookie'), password: 'goodpass123' })
        .expect(201);

      expect(res.body.data.refreshToken).toBeUndefined();

      const cookie = refreshCookie(res);
      expect(cookie).toBeDefined();
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Strict');
      expect(cookie).toContain('Path=/api/v1/auth');
    });

    it('ignores a role sent with the registration', async () => {
      const res = await api
        .post(`${API}/auth/register`)
        .send({ username: uniqueName('sneaky'), password: 'goodpass123', role: 'admin' })
        .expect(201);
      expect(res.body.data.user.role).toBe('customer');
    });

    it('rejects a password shorter than eight characters', async () => {
      const res = await api
        .post(`${API}/auth/register`)
        .send({ username: uniqueName('short'), password: 'short' })
        .expect(400);
      expect(res.body.message).toBe('password must be at least 8 characters');
      expect(res.body.code).toBe('invalid_request');
    });

    it('rejects a username that is already taken in another case', async () => {
      const username = uniqueName('CaseTest');
      await api.post(`${API}/auth/register`).send({ username, password: 'goodpass123' }).expect(201);

      const res = await api
        .post(`${API}/auth/register`)
        .send({ username: username.toUpperCase(), password: 'goodpass123' })
        .expect(409);
      expect(res.body.message).toBe('Username already exists');
    });
  });

  describe('POST /auth/login', () => {
    it('signs in whatever case the username is typed in', async () => {
      const customer = await registerCustomer('caselogin');
      const res = await api
        .post(`${API}/auth/login`)
        .send({ username: customer.username.toUpperCase(), password: customer.password })
        .expect(200);
      expect(res.body.data.user.id).toBe(customer.id);
    });

    it('answers a wrong password with 401 and a code', async () => {
      const customer = await registerCustomer('wrongpass');
      const res = await api
        .post(`${API}/auth/login`)
        .send({ username: customer.username, password: 'not-the-password' })
        .expect(401);

      expect(res.body).toEqual({
        status: 401,
        message: 'Invalid username or password',
        data: null,
        code: 'invalid_credentials',
      });
    });

    it('answers an unknown username the same way as a wrong password', async () => {
      const res = await api
        .post(`${API}/auth/login`)
        .send({ username: uniqueName('ghost'), password: 'whatever123' })
        .expect(401);
      expect(res.body.message).toBe('Invalid username or password');
    });
  });

  describe('POST /auth/refresh', () => {
    it('issues a new access token from the cookie and rotates it', async () => {
      const customer = await registerCustomer('refresher');
      const first = await customer.post('/auth/refresh').expect(200);

      expect(typeof first.body.data.accessToken).toBe('string');
      expect(first.body.data.user.id).toBe(customer.id);
      expect(refreshCookie(first)).toBeDefined();

      await customer.post('/auth/refresh').expect(200);
    });

    it('refuses to refresh without the cookie', async () => {
      const res = await api.post(`${API}/auth/refresh`).expect(401);
      expect(res.body.code).toBe('token_invalid');
    });

    it('ends the whole session when a refresh token is presented a second time', async () => {
      const customer = await registerCustomer('replayer');

      const first = await customer.post('/auth/refresh').expect(200);
      const stolen = refreshCookie(first);
      expect(stolen).toBeDefined();
      const stolenValue = cookieValue(stolen as string);

      await customer.post('/auth/refresh').expect(200);

      await api
        .post(`${API}/auth/refresh`)
        .set('Cookie', [`refreshToken=${stolenValue}`])
        .expect(401);

      await customer.post('/auth/refresh').expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('clears the cookie and ends that session', async () => {
      const customer = await registerCustomer('logouter');
      const res = await customer.post('/auth/logout').expect(200);

      const cookie = refreshCookie(res);
      expect(cookie).toBeDefined();
      expect(cookieValue(cookie as string)).toBe('');

      await customer.post('/auth/refresh').expect(401);
    });

    it('ends every session with logout-all', async () => {
      const customer = await registerCustomer('everywhere');
      const second = await api
        .post(`${API}/auth/login`)
        .send({ username: customer.username, password: customer.password })
        .expect(200);
      const otherSession = refreshCookie(second) as string;

      await customer.post('/auth/logout-all').expect(200);

      await api
        .post(`${API}/auth/refresh`)
        .set('Cookie', [`refreshToken=${cookieValue(otherSession)}`])
        .expect(401);
    });
  });

  describe('GET /auth/me', () => {
    it('returns the signed-in account', async () => {
      const customer = await registerCustomer('me');
      const res = await customer.get('/auth/me').expect(200);
      expect(res.body.data.id).toBe(customer.id);
      expect(res.body.data.password).toBeUndefined();
    });

    it('needs a token', async () => {
      const res = await api.get(`${API}/auth/me`).expect(401);
      expect(res.body.code).toBe('no_token');
    });

    it('rejects a token that is not a JWT', async () => {
      const res = await api.get(`${API}/auth/me`).set('Authorization', 'Bearer not-a-token').expect(401);
      expect(res.body.code).toBe('token_invalid');
    });
  });
});
