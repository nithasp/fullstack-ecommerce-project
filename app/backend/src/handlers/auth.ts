import { Application, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { UserStore } from '../models/user';
import { RefreshTokenStore } from '../models/refreshToken';
import { verifyAuthToken } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/response';
import { config } from '../config';

const userStore = new UserStore();
const refreshTokenStore = new RefreshTokenStore();

const generateAccessToken = (userId: number): string =>
  jwt.sign({ userId }, config.tokenSecret, { expiresIn: config.accessTokenExpiry as jwt.SignOptions['expiresIn'] });

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
  const refreshToken = await refreshTokenStore.create(user.id!, config.refreshTokenExpiryMs);

  res.status(201).json({ status: 201, message: 'Account created successfully.', data: { user, accessToken, refreshToken } });
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
  const refreshToken = await refreshTokenStore.create(user.id!, config.refreshTokenExpiryMs);

  // Fire-and-forget: clean up expired tokens without blocking the response
  refreshTokenStore.deleteExpired().catch(() => {});

  res.json({ status: 200, message: 'Login successful! Welcome back.', data: { user, accessToken, refreshToken } });
});

const refresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken || typeof refreshToken !== 'string')
    throw new AppError('refreshToken is required', 400);

  const stored = await refreshTokenStore.findByToken(refreshToken);
  if (!stored) throw new AppError('Invalid or expired refresh token', 401);

  await refreshTokenStore.deleteByToken(refreshToken);

  const accessToken = generateAccessToken(stored.user_id);
  const newRefreshToken = await refreshTokenStore.create(stored.user_id, config.refreshTokenExpiryMs);

  res.json({ status: 200, message: 'Token refreshed successfully.', data: { accessToken, refreshToken: newRefreshToken } });
});

const logout = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (refreshToken && typeof refreshToken === 'string') {
    await refreshTokenStore.deleteByToken(refreshToken);
  }
  res.json({ status: 200, message: 'Logged out successfully.', data: null });
});

const logoutAll = asyncHandler(async (req: Request, res: Response) => {
  await refreshTokenStore.deleteAllForUser(req.user!.userId);
  res.json({ status: 200, message: 'All sessions revoked.', data: null });
});

const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await userStore.show(req.user!.userId);
  if (!user) throw new AppError('User not found', 404);
  res.json({ status: 200, message: 'User fetched successfully.', data: user });
});

const authRoutes = (app: Application, limiter?: RequestHandler) => {
  const guard = limiter ? [limiter] : [];
  app.post('/auth/register',  ...guard, register);
  app.post('/auth/login',     ...guard, login);
  app.post('/auth/refresh',   ...guard, refresh);
  app.post('/auth/logout',    logout);
  app.post('/auth/logout-all', verifyAuthToken, logoutAll);
  app.get('/auth/me',          verifyAuthToken, me);
};

export default authRoutes;
