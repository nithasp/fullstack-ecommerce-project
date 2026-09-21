import { Request, Response } from 'express';
import { UserRepository } from '../repositories/user.repository';
import { OrderRepository } from '../repositories/order.repository';
import { asyncHandler } from '../utils/asyncHandler';
import { requireSelf } from '../utils/authorize';
import { AppError, sendPage, sendSuccess } from '../utils/response';
import {
  optionalPassword, optionalString, parseId, parsePagination, requirePassword, requireString,
} from '../utils/validate';

const users = new UserRepository();
const orders = new OrderRepository();

export const index = asyncHandler(async (req: Request, res: Response) => {
  const page = parsePagination(req.query);
  const [items, total] = await Promise.all([users.index(page), users.count()]);
  sendPage(res, items, { ...page, total }, 'Users fetched.');
});

export const show = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'user id');
  requireSelf(req, id);
  const user = await users.show(id);
  if (!user) throw new AppError(`user with id ${req.params.id} not found`, 404);
  const recentPurchases = await orders.recentPurchases(id);
  sendSuccess(res, { ...user, recentPurchases }, 'User fetched.');
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const newUser = await users.create({
    firstName: requireString(req.body.firstName, 'firstName'),
    lastName:  requireString(req.body.lastName,  'lastName'),
    username:  requireString(req.body.username,  'username'),
    password:  requirePassword(req.body.password),
  });
  sendSuccess(res, newUser, 'User created.', 201);
});

// Only these four fields are writable here; role changes go through PUT /admin/users/:id/role (OWASP API3)
export const update = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'user id');
  requireSelf(req, id);
  const { firstName, lastName, username, password } = req.body;

  if (!firstName && !lastName && !username && !password)
    throw new AppError('at least one field (firstName, lastName, username, password) is required to update', 400);

  const updatedUser = await users.update(id, {
    firstName: optionalString(firstName, 'firstName'),
    lastName:  optionalString(lastName,  'lastName'),
    username:  optionalString(username,  'username'),
    password:  optionalPassword(password),
  });
  if (!updatedUser) throw new AppError(`user with id ${req.params.id} not found`, 404);
  sendSuccess(res, updatedUser, 'User updated.');
});

export const destroy = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'user id');
  requireSelf(req, id);
  const deleted = await users.delete(id);
  if (!deleted) throw new AppError(`user with id ${req.params.id} not found`, 404);
  sendSuccess(res, deleted, 'User deleted.');
});
