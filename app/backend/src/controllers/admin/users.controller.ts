import { Request, Response } from 'express';
import { idParams, paginationSchema } from '../../schemas/common.schema';
import {
  adminNewUserSchema,
  profileUpdateSchema,
  resetPasswordSchema,
  roleUpdateSchema,
} from '../../schemas/user.schema';
import * as userService from '../../services/user.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../utils/errors';
import { currentUserId } from '../../utils/request';
import { sendSuccess } from '../../utils/response';
import { parse } from '../../utils/validation';

export const index = asyncHandler(async (req: Request, res: Response) => {
  const page = parse(paginationSchema, req.query);
  const { items, total } = await userService.listUsers(page);
  sendSuccess(res, items, 'Users fetched.', 200, { ...page, total });
});

export const show = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parse(idParams, req.params);
  sendSuccess(res, await userService.getUserWithPurchases(id), 'User fetched.');
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = parse(adminNewUserSchema, req.body);
  sendSuccess(res, await userService.createUser(input), 'User created.', 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parse(idParams, req.params);
  const changes = parse(profileUpdateSchema, req.body);
  sendSuccess(res, await userService.updateProfile(id, changes), 'User updated.');
});

// Changing a role ends that account's sessions, so the old privilege cannot be renewed; admins
// cannot change their own role, which keeps the last admin from locking themselves out
export const updateRole = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parse(idParams, req.params);
  const { role } = parse(roleUpdateSchema, req.body);
  sendSuccess(res, await userService.changeRole(currentUserId(req), id, role), 'User role updated.');
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parse(idParams, req.params);
  const { newPassword } = parse(resetPasswordSchema, req.body);
  await userService.setPassword(id, newPassword);
  sendSuccess(res, null, 'Password reset. That user was signed out everywhere.');
});

export const destroy = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parse(idParams, req.params);
  if (id === currentUserId(req)) {
    throw new AppError('You cannot close your own account through the admin API', 400);
  }
  sendSuccess(res, await userService.closeAccount(id), 'Account closed.');
});
