import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';

const request = supertest(app);
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'default-secret-for-dev';

describe('Auth Endpoints', () => {
  const testUser = {
    username: 'authtest_' + Date.now(),
    password: 'test1234',
    firstName: 'Auth',
    lastName: 'Tester',
  };

  let accessToken: string;
  let refreshToken: string;

  describe('POST /auth/register', () => {
    it('should register a new user and return tokens', async () => {
      const res = await request
        .post('/api/v1/auth/register')
        .send(testUser)
        .expect(201);

      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.username).toBe(testUser.username);
      expect(res.body.data.user.password).toBeUndefined();
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();

      const decoded = jwt.verify(res.body.data.accessToken, TOKEN_SECRET) as { userId: number };
      expect(decoded.userId).toBe(res.body.data.user.id);

      expect(res.body.data.refreshToken.split('.').length).not.toBe(3);

      accessToken = res.body.data.accessToken;
      refreshToken = res.body.data.refreshToken;
    });

    it('should return 409 when username already exists', async () => {
      const res = await request
        .post('/api/v1/auth/register')
        .send(testUser)
        .expect(409);

      expect(res.body.message).toBe('Username already exists');
    });

    it('should return 400 when username is missing', async () => {
      const res = await request
        .post('/api/v1/auth/register')
        .send({ password: 'test1234' })
        .expect(400);

      expect(res.body.message).toBe('username is required');
    });

    it('should return 400 when password is too short', async () => {
      const res = await request
        .post('/api/v1/auth/register')
        .send({ username: 'shortpw', password: 'ab' })
        .expect(400);

      expect(res.body.message).toContain('at least 8 characters');
    });
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials and return tokens', async () => {
      const res = await request
        .post('/api/v1/auth/login')
        .send({ username: testUser.username, password: testUser.password })
        .expect(200);

      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.username).toBe(testUser.username);
      expect(res.body.data.user.password).toBeUndefined();
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();

      accessToken = res.body.data.accessToken;
      refreshToken = res.body.data.refreshToken;
    });

    it('should return 401 with wrong password', async () => {
      const res = await request
        .post('/api/v1/auth/login')
        .send({ username: testUser.username, password: 'wrong' })
        .expect(401);

      expect(res.body.message).toBe('Invalid username or password');
    });

    it('should return 401 with non-existent username', async () => {
      const res = await request
        .post('/api/v1/auth/login')
        .send({ username: 'nosuchuser_' + Date.now(), password: 'password' })
        .expect(401);

      expect(res.body.message).toBe('Invalid username or password');
    });

    it('should return 400 when username is missing', async () => {
      await request
        .post('/api/v1/auth/login')
        .send({ password: 'test1234' })
        .expect(400);
    });

    it('should return 400 when password is missing', async () => {
      await request
        .post('/api/v1/auth/login')
        .send({ username: 'someuser' })
        .expect(400);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should return a new access token and rotate the refresh token', async () => {
      const res = await request
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.refreshToken).not.toBe(refreshToken);

      await request
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      accessToken = res.body.data.accessToken;
      refreshToken = res.body.data.refreshToken;
    });

    it('should return 400 when refreshToken is missing', async () => {
      await request
        .post('/api/v1/auth/refresh')
        .send({})
        .expect(400);
    });

    it('should return 401 when refreshToken is invalid', async () => {
      const res = await request
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'totally.invalid.token' })
        .expect(401);

      expect(res.body.message).toBe('Invalid or expired refresh token');
    });
  });

  describe('POST /auth/logout', () => {
    it('should invalidate the refresh token on logout', async () => {
      const loginRes = await request
        .post('/api/v1/auth/login')
        .send({ username: testUser.username, password: testUser.password })
        .expect(200);

      const sessionRefreshToken = loginRes.body.data.refreshToken;
      accessToken = loginRes.body.data.accessToken;

      await request
        .post('/api/v1/auth/logout')
        .send({ refreshToken: sessionRefreshToken })
        .expect(200);

      await request
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: sessionRefreshToken })
        .expect(401);
    });

    it('should succeed even without a refresh token (graceful)', async () => {
      await request
        .post('/api/v1/auth/logout')
        .send({})
        .expect(200);
    });
  });

  describe('POST /auth/logout-all', () => {
    it('should revoke all sessions for the current user', async () => {
      const login1 = await request
        .post('/api/v1/auth/login')
        .send({ username: testUser.username, password: testUser.password });
      const login2 = await request
        .post('/api/v1/auth/login')
        .send({ username: testUser.username, password: testUser.password });

      await request
        .post('/api/v1/auth/logout-all')
        .set('Authorization', `Bearer ${login1.body.data.accessToken}`)
        .expect(200);

      await request
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: login1.body.data.refreshToken })
        .expect(401);

      await request
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: login2.body.data.refreshToken })
        .expect(401);
    });

    it('should require a valid access token', async () => {
      await request
        .post('/api/v1/auth/logout-all')
        .expect(401);
    });
  });

  describe('GET /auth/me', () => {
    beforeAll(async () => {
      const res = await request
        .post('/api/v1/auth/login')
        .send({ username: testUser.username, password: testUser.password });
      accessToken = res.body.data.accessToken;
      refreshToken = res.body.data.refreshToken;
    });

    it('should return the current user when access token is valid', async () => {
      const res = await request
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data.username).toBe(testUser.username);
      expect(res.body.data.password).toBeUndefined();
    });

    it('should return 401 when no token is provided', async () => {
      await request.get('/api/v1/auth/me').expect(401);
    });
  });

  describe('Auth middleware – error codes', () => {
    it('should return code "no_token" when no Authorization header', async () => {
      const res = await request.get('/api/v1/users').expect(401);
      expect(res.body.code).toBe('no_token');
    });

    it('should return code "token_invalid" for a garbage token', async () => {
      const res = await request
        .get('/api/v1/users')
        .set('Authorization', 'Bearer garbage.token.here')
        .expect(401);

      expect(res.body.code).toBe('token_invalid');
    });

    it('should return code "token_expired" for an expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: 1 },
        TOKEN_SECRET,
        { expiresIn: '0s' }
      );

      await new Promise((resolve) => setTimeout(resolve, 1100));

      const res = await request
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(res.body.code).toBe('token_expired');
    });

    it('should allow access with a valid access token', async () => {
      const res = await request
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).not.toBe(401);
    });
  });

  describe('Auth middleware – token checks', () => {
    it('should reject an Authorization scheme other than Bearer', async () => {
      const res = await request
        .get('/api/v1/auth/me')
        .set('Authorization', `Basic ${accessToken}`)
        .expect(401);
      expect(res.body.code).toBe('token_invalid');
    });

    it('should accept the Bearer scheme in any letter case', async () => {
      await request
        .get('/api/v1/auth/me')
        .set('Authorization', `bearer ${accessToken}`)
        .expect(200);
    });

    it('should reject a token signed with another algorithm, even with the right secret', async () => {
      const otherAlgorithm = jwt.sign({ userId: 1, role: 'admin' }, TOKEN_SECRET, { algorithm: 'HS512', expiresIn: '5m' });
      const res = await request
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${otherAlgorithm}`)
        .expect(401);
      expect(res.body.code).toBe('token_invalid');
    });

    it('should reject a token without a numeric userId', async () => {
      const noUserId = jwt.sign({ sub: 'someone' }, TOKEN_SECRET, { expiresIn: '5m' });
      const res = await request
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${noUserId}`)
        .expect(401);
      expect(res.body.code).toBe('token_invalid');
    });
  });

  describe('Refresh-token reuse detection', () => {
    const newSession = async (): Promise<string> => {
      const res = await request
        .post('/api/v1/auth/login')
        .send({ username: testUser.username, password: testUser.password })
        .expect(200);
      return res.body.data.refreshToken;
    };

    it('should revoke the whole session when a used refresh token is presented again', async () => {
      const original = await newSession();
      const rotated = await request.post('/api/v1/auth/refresh').send({ refreshToken: original }).expect(200);
      const successor = rotated.body.data.refreshToken;

      await request.post('/api/v1/auth/refresh').send({ refreshToken: original }).expect(401);
      await request.post('/api/v1/auth/refresh').send({ refreshToken: successor }).expect(401);
    });

    it('should let only one of two simultaneous refreshes with the same token succeed', async () => {
      const token = await newSession();
      const results = await Promise.all([
        request.post('/api/v1/auth/refresh').send({ refreshToken: token }),
        request.post('/api/v1/auth/refresh').send({ refreshToken: token }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
    });

    it('should leave the user\'s other sessions working', async () => {
      const otherSession = await newSession();
      const original = await newSession();
      await request.post('/api/v1/auth/refresh').send({ refreshToken: original }).expect(200);
      await request.post('/api/v1/auth/refresh').send({ refreshToken: original }).expect(401);

      await request.post('/api/v1/auth/refresh').send({ refreshToken: otherSession }).expect(200);
    });

    it('should end the session on logout, including tokens already rotated out of it', async () => {
      const original = await newSession();
      const rotated = await request.post('/api/v1/auth/refresh').send({ refreshToken: original }).expect(200);

      await request.post('/api/v1/auth/logout').send({ refreshToken: rotated.body.data.refreshToken }).expect(200);

      await request.post('/api/v1/auth/refresh').send({ refreshToken: rotated.body.data.refreshToken }).expect(401);
      await request.post('/api/v1/auth/refresh').send({ refreshToken: original }).expect(401);
    });
  });
});
