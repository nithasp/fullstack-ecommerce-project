import { Request, Response } from 'express';
import { auditAs } from '../middleware/audit';
import { loginSchema, registerSchema } from '../schemas/auth.schema';
import { requestSource } from '../services/audit.service';
import {
  issueSession,
  revokeAllSessions,
  revokeSession,
  rotateRefreshToken,
} from '../services/token.service';
import * as userService from '../services/user.service';
import { asyncHandler } from '../utils/asyncHandler';
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from '../utils/refreshCookie';
import { currentUserId } from '../utils/request';
import { AppError, sendSuccess } from '../utils/response';
import { parse } from '../utils/validation';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const input = parse(registerSchema, req.body);

  // Only these fields are read, so a "role" sent here is ignored and self-registration can never
  // create an admin (OWASP API3 mass assignment)
  const user = await userService.createUser({
    username: input.username,
    password: input.password,
    firstName: input.firstName ?? input.username,
    lastName: input.lastName ?? '',
  });

  const { accessToken, refreshToken } = await issueSession(user);
  setRefreshCookie(res, refreshToken);

  auditAs(res, {
    action: 'REGISTER',
    event: 'user.registered',
    userId: user.id,
    username: user.username,
    userRole: user.role,
  });
  sendSuccess(res, { user, accessToken }, 'Account created successfully.', 201);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const input = parse(loginSchema, req.body);

  const user = await userService.authenticate(input.username, input.password);
  if (!user) {
    // The username that was tried is kept (never the password), so repeated guessing shows up in the log
    auditAs(res, { action: 'LOGIN_FAILED', event: 'user.login_failed', username: input.username });
    throw new AppError('Invalid username or password', 401, 'invalid_credentials');
  }

  const { accessToken, refreshToken } = await issueSession(user);
  setRefreshCookie(res, refreshToken);

  auditAs(res, {
    action: 'LOGIN',
    event: 'user.logged_in',
    userId: user.id,
    username: user.username,
    userRole: user.role,
  });
  sendSuccess(res, { user, accessToken }, 'Login successful! Welcome back.');
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = readRefreshCookie(req);
  if (!token) throw new AppError('Invalid or expired refresh token', 401, 'token_invalid');

  const { user, accessToken, refreshToken } = await rotateRefreshToken(token, requestSource(req));
  setRefreshCookie(res, refreshToken);

  sendSuccess(res, { user, accessToken }, 'Token refreshed successfully.');
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = readRefreshCookie(req);
  if (token) {
    const userId = await revokeSession(token);
    if (userId) auditAs(res, { action: 'LOGOUT', event: 'user.logged_out', userId });
  }
  clearRefreshCookie(res);
  sendSuccess(res, null, 'Logged out successfully.');
});

export const logoutAll = asyncHandler(async (req: Request, res: Response) => {
  await revokeAllSessions(currentUserId(req));
  clearRefreshCookie(res);
  auditAs(res, { action: 'LOGOUT', event: 'user.logged_out_everywhere' });
  sendSuccess(res, null, 'All sessions revoked.');
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await userService.requireUser(currentUserId(req)), 'User fetched successfully.');
});
