import { Request, Response } from 'express';
import { auditAs } from '../middleware/audit';
import { UserRepository } from '../repositories/user.repository';
import { requestSource } from '../services/audit.service';
import { issueTokens, revokeAllSessions, revokeSession, rotateRefreshToken } from '../services/token.service';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError, sendSuccess } from '../utils/response';
import { requirePassword } from '../utils/validate';

const users = new UserRepository();

const optionalName = (val: unknown): string | undefined =>
  typeof val === 'string' && val.trim() ? val.trim() : undefined;

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { username } = req.body;
  if (!username || typeof username !== 'string' || !username.trim())
    throw new AppError('username is required', 400);
  const password = requirePassword(req.body.password);

  const existing = await users.findByUsername(username.trim());
  if (existing) throw new AppError('Username already exists', 409);

  // Only the listed fields are read from the body; a "role" sent here is ignored,
  // so self-registration can never create an admin (OWASP API3 mass assignment)
  const user = await users.create({
    username: username.trim(),
    password,
    firstName: optionalName(req.body.firstName) ?? username.trim(),
    lastName: optionalName(req.body.lastName) ?? '',
  });

  auditAs(res, { action: 'REGISTER', event: 'user.registered', userId: user.id, username: user.username, userRole: user.role });
  sendSuccess(res, { user, ...(await issueTokens(user)) }, 'Account created successfully.', 201);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || typeof username !== 'string' || !username.trim())
    throw new AppError('username is required', 400);
  if (!password || typeof password !== 'string')
    throw new AppError('password is required', 400);

  const user = await users.authenticate(username.trim(), password);
  if (!user) {
    // The username that was tried is kept (never the password), so repeated guessing shows up in the log
    auditAs(res, { action: 'LOGIN_FAILED', event: 'user.login_failed', username: username.trim() });
    throw new AppError('Invalid username or password', 401);
  }

  auditAs(res, { action: 'LOGIN', event: 'user.logged_in', userId: user.id, username: user.username, userRole: user.role });
  sendSuccess(res, { user, ...(await issueTokens(user)) }, 'Login successful! Welcome back.');
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken || typeof refreshToken !== 'string')
    throw new AppError('refreshToken is required', 400);

  sendSuccess(res, await rotateRefreshToken(refreshToken, requestSource(req)), 'Token refreshed successfully.');
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (refreshToken && typeof refreshToken === 'string') {
    const userId = await revokeSession(refreshToken);
    if (userId) auditAs(res, { action: 'LOGOUT', event: 'user.logged_out', userId });
  }
  sendSuccess(res, null, 'Logged out successfully.');
});

export const logoutAll = asyncHandler(async (req: Request, res: Response) => {
  await revokeAllSessions(req.user!.userId);
  auditAs(res, { action: 'LOGOUT', event: 'user.logged_out_everywhere' });
  sendSuccess(res, null, 'All sessions revoked.');
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await users.show(req.user!.userId);
  if (!user) throw new AppError('User not found', 404);
  sendSuccess(res, user, 'User fetched successfully.');
});
