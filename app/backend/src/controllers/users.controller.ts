import { Request, Response } from 'express';
import { idParams } from '../schemas/common.schema';
import { changePasswordSchema, profileUpdateSchema } from '../schemas/user.schema';
import * as userService from '../services/user.service';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/errors';
import { setRefreshCookie } from '../utils/refreshCookie';
import { currentUserId } from '../utils/request';
import { sendSuccess } from '../utils/response';
import { parse } from '../utils/validation';

// These routes only ever serve the account the token belongs to; an admin manages other accounts
// through /admin/users (OWASP API1)
function requireSelf(req: Request): number {
  const { id } = parse(idParams, req.params);
  if (id !== currentUserId(req)) throw new AppError('You can only access your own data', 403, 'forbidden');
  return id;
}

export const show = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await userService.getUserWithPurchases(requireSelf(req)), 'User fetched.');
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const id = requireSelf(req);
  const changes = parse(profileUpdateSchema, req.body);
  sendSuccess(res, await userService.updateProfile(id, changes), 'User updated.');
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const id = requireSelf(req);
  const { currentPassword, newPassword } = parse(changePasswordSchema, req.body);

  const { user, accessToken, refreshToken } = await userService.changeOwnPassword(
    id,
    currentPassword,
    newPassword,
  );
  setRefreshCookie(res, refreshToken);

  sendSuccess(res, { user, accessToken }, 'Password changed. Other sessions were signed out.');
});

export const destroy = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await userService.closeAccount(requireSelf(req)), 'Account closed.');
});
