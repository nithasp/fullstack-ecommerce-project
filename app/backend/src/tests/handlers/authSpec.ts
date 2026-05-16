import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../server';

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

  // ── Register ──────────────────────────────────────────────────────────────

  describe('POST /auth/register', () => {
    it('should register a new user and return tokens', async () => {
      const res = await request
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.username).toBe(testUser.username);
      expect(res.body.data.user.password).toBeUndefined();
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();

      // Access token should be a valid JWT with userId
      const decoded = jwt.verify(res.body.data.accessToken, TOKEN_SECRET) as { userId: number };
      expect(decoded.userId).toBe(res.body.data.user.id);

      // Refresh token should be an opaque string (not a JWT)
      expect(res.body.data.refreshToken.split('.').length).not.toBe(3);

      accessToken = res.body.data.accessToken;
      refreshToken = res.body.data.refreshToken;
    });

    it('should return 409 when username already exists', async () => {
      const res = await request
        .post('/auth/register')
        .send(testUser)
        .expect(409);

      expect(res.body.message).toBe('Username already exists');
    });

    it('should return 400 when username is missing', async () => {
      const res = await request
        .post('/auth/register')
        .send({ password: 'test1234' })
        .expect(400);

      expect(res.body.message).toBe('username is required');
    });

    it('should return 400 when password is too short', async () => {
      const res = await request
        .post('/auth/register')
        .send({ username: 'shortpw', password: 'ab' })
        .expect(400);

      expect(res.body.message).toContain('at least 8 characters');
    });
  });

  // ── Login ─────────────────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('should login with valid credentials and return tokens', async () => {
      const res = await request
        .post('/auth/login')
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
        .post('/auth/login')
        .send({ username: testUser.username, password: 'wrong' })
        .expect(401);

      expect(res.body.message).toBe('Invalid username or password');
    });

    it('should return 401 with non-existent username', async () => {
      const res = await request
        .post('/auth/login')
        .send({ username: 'nosuchuser_' + Date.now(), password: 'password' })
        .expect(401);

      expect(res.body.message).toBe('Invalid username or password');
    });

    it('should return 400 when username is missing', async () => {
      await request
        .post('/auth/login')
        .send({ password: 'test1234' })
        .expect(400);
    });

    it('should return 400 when password is missing', async () => {
      await request
        .post('/auth/login')
        .send({ username: 'someuser' })
        .expect(400);
    });
  });

  // ── Refresh (with rotation) ───────────────────────────────────────────────

  describe('POST /auth/refresh', () => {
    it('should return a new access token and rotate the refresh token', async () => {
      const res = await request
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.refreshToken).not.toBe(refreshToken); // rotated

      // Old refresh token should now be invalid
      await request
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      // Update tokens for subsequent tests
      accessToken = res.body.data.accessToken;
      refreshToken = res.body.data.refreshToken;
    });

    it('should return 400 when refreshToken is missing', async () => {
      await request
        .post('/auth/refresh')
        .send({})
        .expect(400);
    });

    it('should return 401 when refreshToken is invalid', async () => {
      const res = await request
        .post('/auth/refresh')
        .send({ refreshToken: 'totally.invalid.token' })
        .expect(401);

      expect(res.body.message).toBe('Invalid or expired refresh token');
    });
  });

  // ── Logout ────────────────────────────────────────────────────────────────

  describe('POST /auth/logout', () => {
    it('should invalidate the refresh token on logout', async () => {
      // Login to get a fresh session
      const loginRes = await request
        .post('/auth/login')
        .send({ username: testUser.username, password: testUser.password })
        .expect(200);

      const sessionRefreshToken = loginRes.body.data.refreshToken;
      accessToken = loginRes.body.data.accessToken;

      // Logout
      await request
        .post('/auth/logout')
        .send({ refreshToken: sessionRefreshToken })
        .expect(200);

      // Refresh with the same token should fail
      await request
        .post('/auth/refresh')
        .send({ refreshToken: sessionRefreshToken })
        .expect(401);
    });

    it('should succeed even without a refresh token (graceful)', async () => {
      await request
        .post('/auth/logout')
        .send({})
        .expect(200);
    });
  });

  // ── Logout All ────────────────────────────────────────────────────────────

  describe('POST /auth/logout-all', () => {
    it('should revoke all sessions for the current user', async () => {
      // Create two sessions
      const login1 = await request
        .post('/auth/login')
        .send({ username: testUser.username, password: testUser.password });
      const login2 = await request
        .post('/auth/login')
        .send({ username: testUser.username, password: testUser.password });

      // Logout all using session 1's access token
      await request
        .post('/auth/logout-all')
        .set('Authorization', `Bearer ${login1.body.data.accessToken}`)
        .expect(200);

      // Both refresh tokens should now be invalid
      await request
        .post('/auth/refresh')
        .send({ refreshToken: login1.body.data.refreshToken })
        .expect(401);

      await request
        .post('/auth/refresh')
        .send({ refreshToken: login2.body.data.refreshToken })
        .expect(401);
    });

    it('should require a valid access token', async () => {
      await request
        .post('/auth/logout-all')
        .expect(401);
    });
  });

  // ── Protected route (GET /auth/me) ────────────────────────────────────────

  describe('GET /auth/me', () => {
    beforeAll(async () => {
      const res = await request
        .post('/auth/login')
        .send({ username: testUser.username, password: testUser.password });
      accessToken = res.body.data.accessToken;
      refreshToken = res.body.data.refreshToken;
    });

    it('should return the current user when access token is valid', async () => {
      const res = await request
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data.username).toBe(testUser.username);
      expect(res.body.data.password).toBeUndefined();
    });

    it('should return 401 when no token is provided', async () => {
      await request.get('/auth/me').expect(401);
    });
  });

  // ── Middleware error codes ────────────────────────────────────────────────

  describe('Auth middleware – error codes', () => {
    it('should return code "no_token" when no Authorization header', async () => {
      const res = await request.get('/users').expect(401);
      expect(res.body.code).toBe('no_token');
    });

    it('should return code "token_invalid" for a garbage token', async () => {
      const res = await request
        .get('/users')
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

      // Small delay to ensure the token is past its expiry
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const res = await request
        .get('/users')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(res.body.code).toBe('token_expired');
    });

    it('should allow access with a valid access token', async () => {
      const res = await request
        .get('/users')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).not.toBe(401);
    });
  });
});
