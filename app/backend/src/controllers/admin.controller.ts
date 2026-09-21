import { Request, Response } from 'express';
import { UserRepository } from '../repositories/user.repository';
import { OrderRepository } from '../repositories/order.repository';
import { CartRepository } from '../repositories/cart.repository';
import { AddressRepository } from '../repositories/address.repository';
import { revokeAllSessions } from '../services/token.service';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError, sendPage, sendSuccess } from '../utils/response';
import {
  optionalPassword, optionalRole, optionalString, parseAddressUpdate, parseCartItemPayload, parseId,
  parseNewAddress, parseOrderStatus, parsePagination, requirePassword, requirePositiveInt, requireRole,
  requireString,
} from '../utils/validate';

/**
 * Admin API — every route here requires a valid access token whose account is an admin
 * (re-checked against the database on each request). Mutations are written to the audit log.
 *
 * Unlike the customer routes, these are not scoped to the token user: an admin can list and
 * manage users, orders, carts and addresses belonging to any account.
 */

const users = new UserRepository();
const orders = new OrderRepository();
const carts = new CartRepository();
const addresses = new AddressRepository();

const requireUserExists = async (userId: number) => {
  const user = await users.show(userId);
  if (!user) throw new AppError(`user with id ${userId} not found`, 404);
  return user;
};

const optionalUserIdFilter = (req: Request): number | undefined => {
  const raw = req.query.userId as string | undefined;
  return raw ? parseId(raw, 'userId filter') : undefined;
};

// ── Users ────────────────────────────────────────────────────────────────────

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const page = parsePagination(req.query);
  const [items, total] = await Promise.all([users.index(page), users.count()]);
  sendPage(res, items, { ...page, total }, 'Users fetched.');
});

export const showUser = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'user id');
  const user = await requireUserExists(id);
  const recentPurchases = await orders.recentPurchases(id);
  sendSuccess(res, { ...user, recentPurchases }, 'User fetched.');
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const username = requireString(req.body.username, 'username');
  const password = requirePassword(req.body.password);
  if (await users.findByUsername(username)) throw new AppError('Username already exists', 409);

  const user = await users.create({
    firstName: requireString(req.body.firstName, 'firstName'),
    lastName:  requireString(req.body.lastName,  'lastName'),
    username,
    password,
    role: optionalRole(req.body.role) ?? 'customer',
  });
  sendSuccess(res, user, 'User created.', 201);
});

// Profile fields only — the role has its own audited route below
export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'user id');
  const { firstName, lastName, username, password } = req.body;
  if (!firstName && !lastName && !username && !password)
    throw new AppError('at least one field (firstName, lastName, username, password) is required to update', 400);

  const updated = await users.update(id, {
    firstName: optionalString(firstName, 'firstName'),
    lastName:  optionalString(lastName,  'lastName'),
    username:  optionalString(username,  'username'),
    password:  optionalPassword(password),
  });
  if (!updated) throw new AppError(`user with id ${id} not found`, 404);
  sendSuccess(res, updated, 'User updated.');
});

// Changing a role revokes that user's refresh tokens so the old privilege can't be renewed;
// admins can't change their own role, which prevents locking the last admin out by accident
export const updateUserRole = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'user id');
  const role = requireRole(req.body.role);
  if (id === req.user!.userId) throw new AppError('You cannot change your own role', 400);

  const updated = await users.updateRole(id, role);
  if (!updated) throw new AppError(`user with id ${id} not found`, 404);
  await revokeAllSessions(id);
  sendSuccess(res, updated, 'User role updated.');
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'user id');
  if (id === req.user!.userId) throw new AppError('You cannot delete your own account through the admin API', 400);
  const deleted = await users.delete(id);
  if (!deleted) throw new AppError(`user with id ${id} not found`, 404);
  sendSuccess(res, deleted, 'User deleted.');
});

// ── Orders ───────────────────────────────────────────────────────────────────

export const listOrders = asyncHandler(async (req: Request, res: Response) => {
  const status = req.query.status !== undefined ? parseOrderStatus(req.query.status, 'status filter') : undefined;
  const filters = { status, userId: optionalUserIdFilter(req) };
  const page = parsePagination(req.query);
  const [items, total] = await Promise.all([orders.index(filters, page), orders.count(filters)]);
  sendPage(res, items, { ...page, total }, 'Orders fetched.');
});

const requireOrder = async (id: number) => {
  const order = await orders.show(id);
  if (!order) throw new AppError(`order with id ${id} not found`, 404);
  return order;
};

export const showOrder = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await requireOrder(parseId(req.params.id, 'order id')), 'Order fetched.');
});

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const userId = requirePositiveInt(req.body.userId, 'userId');
  await requireUserExists(userId);
  const status = req.body.status !== undefined ? parseOrderStatus(req.body.status) : 'active';
  sendSuccess(res, await orders.create({ userId, status }), 'Order created.', 201);
});

export const updateOrder = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'order id');
  const status = parseOrderStatus(req.body.status);
  const updated = await orders.update(id, status);
  if (!updated) throw new AppError(`order with id ${id} not found`, 404);
  sendSuccess(res, updated, 'Order updated.');
});

export const deleteOrder = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'order id');
  const deleted = await orders.delete(id);
  if (!deleted) throw new AppError(`order with id ${id} not found`, 404);
  sendSuccess(res, deleted, 'Order deleted.');
});

export const listOrderProducts = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'order id');
  await requireOrder(id);
  sendSuccess(res, await orders.getOrderProducts(id), 'Order products fetched.');
});

export const addOrderProduct = asyncHandler(async (req: Request, res: Response) => {
  const orderId = parseId(req.params.id, 'order id in URL');
  await requireOrder(orderId);
  const productId = requirePositiveInt(req.body.productId, 'productId');
  const quantity = requirePositiveInt(req.body.quantity, 'quantity');
  sendSuccess(res, await orders.addProduct({ orderId, productId, quantity }), 'Product added to order.');
});

// ── Carts ────────────────────────────────────────────────────────────────────

export const listCartItems = asyncHandler(async (req: Request, res: Response) => {
  const filters = { userId: optionalUserIdFilter(req) };
  const page = parsePagination(req.query);
  const [items, total] = await Promise.all([carts.getAll(filters, page), carts.count(filters)]);
  sendPage(res, items, { ...page, total }, 'Cart items fetched.');
});

export const showUserCart = asyncHandler(async (req: Request, res: Response) => {
  const userId = parseId(req.params.userId, 'userId');
  await requireUserExists(userId);
  sendSuccess(res, await carts.getByUser(userId), 'Cart fetched.');
});

export const addUserCartItem = asyncHandler(async (req: Request, res: Response) => {
  const userId = parseId(req.params.userId, 'userId');
  await requireUserExists(userId);
  sendSuccess(res, await carts.upsert(userId, parseCartItemPayload(req.body)), 'Item added to cart.', 201);
});

export const clearUserCart = asyncHandler(async (req: Request, res: Response) => {
  const userId = parseId(req.params.userId, 'userId');
  await requireUserExists(userId);
  await carts.clearByUser(userId);
  sendSuccess(res, null, 'Cart cleared.');
});

export const showCartItem = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'cart item id');
  const item = await carts.showById(id);
  if (!item) throw new AppError(`Cart item ${id} not found`, 404);
  sendSuccess(res, item, 'Cart item fetched.');
});

export const updateCartItem = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'cart item id');
  const quantity = requirePositiveInt(req.body.quantity, 'quantity');
  const updated = await carts.updateQuantityById(id, quantity);
  if (!updated) throw new AppError(`Cart item ${id} not found`, 404);
  sendSuccess(res, updated, 'Cart item updated.');
});

export const deleteCartItem = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'cart item id');
  const deleted = await carts.removeById(id);
  if (!deleted) throw new AppError(`Cart item ${id} not found`, 404);
  sendSuccess(res, deleted, 'Cart item removed.');
});

// ── Addresses ────────────────────────────────────────────────────────────────

export const listAddresses = asyncHandler(async (req: Request, res: Response) => {
  const filters = { userId: optionalUserIdFilter(req) };
  const page = parsePagination(req.query);
  const [items, total] = await Promise.all([addresses.getAll(filters, page), addresses.count(filters)]);
  sendPage(res, items, { ...page, total }, 'Addresses fetched.');
});

const requireAddress = async (id: number) => {
  const address = await addresses.showById(id);
  if (!address) throw new AppError(`Address ${id} not found`, 404);
  return address;
};

export const showAddress = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await requireAddress(parseId(req.params.id, 'address id')), 'Address fetched.');
});

export const createAddress = asyncHandler(async (req: Request, res: Response) => {
  const userId = requirePositiveInt(req.body.userId, 'userId');
  await requireUserExists(userId);
  sendSuccess(res, await addresses.create(userId, parseNewAddress(req.body)), 'Address created.', 201);
});

// The owner is looked up from the address itself so the default-address bookkeeping stays per user
export const updateAddress = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'address id');
  const existing = await requireAddress(id);

  const form = parseAddressUpdate(req.body);
  if (Object.keys(form).length === 0) throw new AppError('at least one field is required to update', 400);

  const updated = await addresses.update(id, existing.userId, form);
  if (!updated) throw new AppError(`Address ${id} not found`, 404);
  sendSuccess(res, updated, 'Address updated.');
});

export const deleteAddress = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'address id');
  const existing = await requireAddress(id);
  const deleted = await addresses.delete(id, existing.userId);
  if (!deleted) throw new AppError(`Address ${id} not found`, 404);
  sendSuccess(res, deleted, 'Address deleted.');
});
