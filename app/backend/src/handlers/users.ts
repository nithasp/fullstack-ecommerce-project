import { Application, Request, Response } from 'express';
import { UserStore } from '../models/user';
import { OrderStore } from '../models/order';
import { verifyAuthToken } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError, sendSuccess } from '../utils/response';
import { parseId, requireString, optionalString } from '../utils/validate';

const store = new UserStore();
const orderStore = new OrderStore();

const index = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await store.index(), 'Users fetched.');
});

const show = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'user id');
  const user = await store.show(id);
  if (!user) throw new AppError(`user with id ${req.params.id} not found`, 404);
  const recentPurchases = await orderStore.recentPurchases(id);
  sendSuccess(res, { ...user, recentPurchases }, 'User fetched.');
});

const create = asyncHandler(async (req: Request, res: Response) => {
  const newUser = await store.create({
    firstName: requireString(req.body.firstName, 'firstName'),
    lastName:  requireString(req.body.lastName,  'lastName'),
    username:  requireString(req.body.username,  'username'),
    password:  requireString(req.body.password,  'password'),
  });
  sendSuccess(res, newUser, 'User created.', 201);
});

const update = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'user id');
  const { firstName, lastName, username, password } = req.body;

  if (!firstName && !lastName && !username && !password)
    throw new AppError('at least one field (firstName, lastName, username, password) is required to update', 400);

  const updatedUser = await store.update(id, {
    firstName: optionalString(firstName, 'firstName'),
    lastName:  optionalString(lastName,  'lastName'),
    username:  optionalString(username,  'username'),
    password:  optionalString(password,  'password'),
  });
  if (!updatedUser) throw new AppError(`user with id ${req.params.id} not found`, 404);
  sendSuccess(res, updatedUser, 'User updated.');
});

const destroy = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'user id');
  const deleted = await store.delete(id);
  if (!deleted) throw new AppError(`user with id ${req.params.id} not found`, 404);
  sendSuccess(res, deleted, 'User deleted.');
});

const userRoutes = (app: Application) => {
  app.get('/users',      verifyAuthToken, index);
  app.get('/users/:id',  verifyAuthToken, show);
  app.post('/users',     verifyAuthToken, create);
  app.put('/users/:id',  verifyAuthToken, update);
  app.delete('/users/:id', verifyAuthToken, destroy);
};

export default userRoutes;
