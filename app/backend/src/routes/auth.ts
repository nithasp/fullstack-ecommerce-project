import { Request, RequestHandler, Response, Router } from 'express';
import jwt from 'jsonwebtoken';
import { UserStore } from '../models/user';
import { RefreshTokenStore } from '../models/refreshToken';
import { verifyAuthToken } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError, sendSuccess } from '../utils/response';
import { config } from '../config';

const userStore = new UserStore();
const refreshTokenStore = new RefreshTokenStore();

const generateAccessToken = (userId: number): string =>
  jwt.sign({ userId }, config.jwt.secret, { expiresIn: config.jwt.accessTokenExpiry as jwt.SignOptions['expiresIn'] });

const register = asyncHandler(async (req: Request, res: Response) => {
  const { username, password, firstName, lastName } = req.body;

  if (!username || typeof username !== 'string' || !username.trim())
    throw new AppError('username is required', 400);
  if (!password || typeof password !== 'string' || password.length < 8)
    throw new AppError('password is required and must be at least 8 characters', 400);

  const existing = await userStore.findByUsername(username.trim());
  if (existing) throw new AppError('Username already exists', 409);

  const user = await userStore.create({
    username: username.trim(),
    password,
    firstName: firstName?.trim() || username.trim(),
    lastName: lastName?.trim() || '',
  });

  const accessToken = generateAccessToken(user.id!);
  const refreshToken = await refreshTokenStore.create(user.id!, config.jwt.refreshTokenExpiryMs);

  sendSuccess(res, { user, accessToken, refreshToken }, 'Account created successfully.', 201);
});

const login = asyncHandler(async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || typeof username !== 'string' || !username.trim())
    throw new AppError('username is required', 400);
  if (!password || typeof password !== 'string')
    throw new AppError('password is required', 400);

  const user = await userStore.authenticate(username.trim(), password);
  if (!user) throw new AppError('Invalid username or password', 401);

  const accessToken = generateAccessToken(user.id!);
  const refreshToken = await refreshTokenStore.create(user.id!, config.jwt.refreshTokenExpiryMs);

  // Fire-and-forget: clean up expired tokens without blocking the response
  refreshTokenStore.deleteExpired().catch(() => {});

  sendSuccess(res, { user, accessToken, refreshToken }, 'Login successful! Welcome back.');
});

const refresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken || typeof refreshToken !== 'string')
    throw new AppError('refreshToken is required', 400);

  const stored = await refreshTokenStore.findByToken(refreshToken);
  if (!stored) throw new AppError('Invalid or expired refresh token', 401);

  await refreshTokenStore.deleteByToken(refreshToken);

  const accessToken = generateAccessToken(stored.user_id);
  const newRefreshToken = await refreshTokenStore.create(stored.user_id, config.jwt.refreshTokenExpiryMs);

  sendSuccess(res, { accessToken, refreshToken: newRefreshToken }, 'Token refreshed successfully.');
});

const logout = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (refreshToken && typeof refreshToken === 'string') {
    await refreshTokenStore.deleteByToken(refreshToken);
  }
  sendSuccess(res, null, 'Logged out successfully.');
});

const logoutAll = asyncHandler(async (req: Request, res: Response) => {
  await refreshTokenStore.deleteAllForUser(req.user!.userId);
  sendSuccess(res, null, 'All sessions revoked.');
});

const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await userStore.show(req.user!.userId);
  if (!user) throw new AppError('User not found', 404);
  sendSuccess(res, user, 'User fetched successfully.');
});

/** Credential endpoints take an optional rate limiter (disabled in tests). */
const createAuthRouter = (limiter?: RequestHandler): Router => {
  const router = Router();
  const guard = limiter ? [limiter] : [];

  router.post('/register', ...guard, register);
  router.post('/login', ...guard, login);
  router.post('/refresh', ...guard, refresh);
  router.post('/logout', logout);
  router.post('/logout-all', verifyAuthToken, logoutAll);
  router.get('/me', verifyAuthToken, me);

  return router;
};

export default createAuthRouter;
