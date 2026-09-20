import { Application, Request, Response } from 'express';
import { UserStore } from '../models/user';
import { OrderStore } from '../models/order';
import { CartStore } from '../models/cart';
import { AddressStore } from '../models/address';
import { RefreshTokenStore } from '../models/refreshToken';
import { verifyAuthToken, requireAdmin, auditAdmin } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError, sendSuccess } from '../utils/response';
import {
  parseId, parsePagination, requireString, optionalString, requirePositiveInt, requireRole, optionalRole,
} from '../utils/validate';
import { parseOrderStatus } from './orders';
import { parseCartItemPayload } from './cart';

/**
 * Admin API — every route here requires a valid access token whose account is an admin
 * (re-checked against the database on each request). Mutations are written to the audit log.
 *
 * Unlike the customer routes, these are not scoped to the token user: an admin can list and
 * manage users, orders, carts and addresses belonging to any account.
 */

const userStore = new UserStore();
const orderStore = new OrderStore();
const cartStore = new CartStore();
const addressStore = new AddressStore();
const refreshTokenStore = new RefreshTokenStore();
const VALID_LABELS = ['home', 'work', 'other'] as const;

function parseLabel(val: unknown): 'home' | 'work' | 'other' {
  return VALID_LABELS.includes(val as 'home' | 'work' | 'other') ? val as 'home' | 'work' | 'other' : 'home';
}

const requireUserExists = async (userId: number) => {
  const user = await userStore.show(userId);
  if (!user) throw new AppError(`user with id ${userId} not found`, 404);
  return user;
};

const optionalUserIdFilter = (req: Request): number | undefined => {
  const raw = req.query.userId as string | undefined;
  return raw ? parseId(raw, 'userId filter') : undefined;
};

// ── Users ────────────────────────────────────────────────────────────────────

const listUsers = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await userStore.index(parsePagination(req.query)), 'Users fetched.');
});

const showUser = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'user id');
  const user = await requireUserExists(id);
  const recentPurchases = await orderStore.recentPurchases(id);
  sendSuccess(res, { ...user, recentPurchases }, 'User fetched.');
});

const createUser = asyncHandler(async (req: Request, res: Response) => {
  const username = requireString(req.body.username, 'username');
  const password = requireString(req.body.password, 'password');
  if (password.length < 8) throw new AppError('password must be at least 8 characters', 400);
  if (await userStore.findByUsername(username)) throw new AppError('Username already exists', 409);

  const user = await userStore.create({
    firstName: requireString(req.body.firstName, 'firstName'),
    lastName:  requireString(req.body.lastName,  'lastName'),
    username,
    password,
    role: optionalRole(req.body.role) ?? 'customer',
  });
  sendSuccess(res, user, 'User created.', 201);
});

// Profile fields only — the role has its own audited route below
const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'user id');
  const { firstName, lastName, username, password } = req.body;
  if (!firstName && !lastName && !username && !password)
    throw new AppError('at least one field (firstName, lastName, username, password) is required to update', 400);

  const updated = await userStore.update(id, {
    firstName: optionalString(firstName, 'firstName'),
    lastName:  optionalString(lastName,  'lastName'),
    username:  optionalString(username,  'username'),
    password:  optionalString(password,  'password'),
  });
  if (!updated) throw new AppError(`user with id ${id} not found`, 404);
  sendSuccess(res, updated, 'User updated.');
});

// Changing a role revokes that user's refresh tokens so the old privilege can't be renewed;
// admins can't change their own role, which prevents locking the last admin out by accident
const updateUserRole = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'user id');
  const role = requireRole(req.body.role);
  if (id === req.user!.userId) throw new AppError('You cannot change your own role', 400);

  const updated = await userStore.updateRole(id, role);
  if (!updated) throw new AppError(`user with id ${id} not found`, 404);
  await refreshTokenStore.deleteAllForUser(id);
  sendSuccess(res, updated, 'User role updated.');
});

const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'user id');
  if (id === req.user!.userId) throw new AppError('You cannot delete your own account through the admin API', 400);
  const deleted = await userStore.delete(id);
  if (!deleted) throw new AppError(`user with id ${id} not found`, 404);
  sendSuccess(res, deleted, 'User deleted.');
});

// ── Orders ───────────────────────────────────────────────────────────────────

const listOrders = asyncHandler(async (req: Request, res: Response) => {
  const status = req.query.status !== undefined ? parseOrderStatus(req.query.status, 'status filter') : undefined;
  const userId = optionalUserIdFilter(req);
  sendSuccess(res, await orderStore.index({ status, userId }, parsePagination(req.query)), 'Orders fetched.');
});

const requireOrder = async (id: number) => {
  const order = await orderStore.show(id);
  if (!order) throw new AppError(`order with id ${id} not found`, 404);
  return order;
};

const showOrder = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await requireOrder(parseId(req.params.id, 'order id')), 'Order fetched.');
});

const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const userId = requirePositiveInt(req.body.userId, 'userId');
  await requireUserExists(userId);
  const status = req.body.status !== undefined ? parseOrderStatus(req.body.status) : 'active';
  sendSuccess(res, await orderStore.create({ userId, status }), 'Order created.', 201);
});

const updateOrder = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'order id');
  const status = parseOrderStatus(req.body.status);
  const updated = await orderStore.update(id, status);
  if (!updated) throw new AppError(`order with id ${id} not found`, 404);
  sendSuccess(res, updated, 'Order updated.');
});

const deleteOrder = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'order id');
  const deleted = await orderStore.delete(id);
  if (!deleted) throw new AppError(`order with id ${id} not found`, 404);
  sendSuccess(res, deleted, 'Order deleted.');
});

const listOrderProducts = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'order id');
  await requireOrder(id);
  sendSuccess(res, await orderStore.getOrderProducts(id), 'Order products fetched.');
});

const addOrderProduct = asyncHandler(async (req: Request, res: Response) => {
  const orderId = parseId(req.params.id, 'order id in URL');
  await requireOrder(orderId);
  const productId = requirePositiveInt(req.body.productId, 'productId');
  const quantity = requirePositiveInt(req.body.quantity, 'quantity');
  sendSuccess(res, await orderStore.addProduct({ orderId, productId, quantity }), 'Product added to order.');
});

// ── Carts ────────────────────────────────────────────────────────────────────

const listCartItems = asyncHandler(async (req: Request, res: Response) => {
  const userId = optionalUserIdFilter(req);
  sendSuccess(res, await cartStore.getAll({ userId }, parsePagination(req.query)), 'Cart items fetched.');
});

const showUserCart = asyncHandler(async (req: Request, res: Response) => {
  const userId = parseId(req.params.userId, 'userId');
  await requireUserExists(userId);
  sendSuccess(res, await cartStore.getByUser(userId), 'Cart fetched.');
});

const addUserCartItem = asyncHandler(async (req: Request, res: Response) => {
  const userId = parseId(req.params.userId, 'userId');
  await requireUserExists(userId);
  sendSuccess(res, await cartStore.upsert(userId, parseCartItemPayload(req.body)), 'Item added to cart.', 201);
});

const clearUserCart = asyncHandler(async (req: Request, res: Response) => {
  const userId = parseId(req.params.userId, 'userId');
  await requireUserExists(userId);
  await cartStore.clearByUser(userId);
  sendSuccess(res, null, 'Cart cleared.');
});

const showCartItem = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'cart item id');
  const item = await cartStore.showById(id);
  if (!item) throw new AppError(`Cart item ${id} not found`, 404);
  sendSuccess(res, item, 'Cart item fetched.');
});

const updateCartItem = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'cart item id');
  const quantity = requirePositiveInt(req.body.quantity, 'quantity');
  const updated = await cartStore.updateQuantityById(id, quantity);
  if (!updated) throw new AppError(`Cart item ${id} not found`, 404);
  sendSuccess(res, updated, 'Cart item updated.');
});

const deleteCartItem = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'cart item id');
  const deleted = await cartStore.removeById(id);
  if (!deleted) throw new AppError(`Cart item ${id} not found`, 404);
  sendSuccess(res, deleted, 'Cart item removed.');
});

// ── Addresses ────────────────────────────────────────────────────────────────

const listAddresses = asyncHandler(async (req: Request, res: Response) => {
  const userId = optionalUserIdFilter(req);
  sendSuccess(res, await addressStore.getAll({ userId }, parsePagination(req.query)), 'Addresses fetched.');
});

const requireAddress = async (id: number) => {
  const address = await addressStore.showById(id);
  if (!address) throw new AppError(`Address ${id} not found`, 404);
  return address;
};

const showAddress = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await requireAddress(parseId(req.params.id, 'address id')), 'Address fetched.');
});

const createAddress = asyncHandler(async (req: Request, res: Response) => {
  const userId    = requirePositiveInt(req.body.userId, 'userId');
  await requireUserExists(userId);

  const fullName  = requireString(req.body.fullName, 'fullName');
  const address   = requireString(req.body.address,  'address');
  const city      = requireString(req.body.city,     'city');
  const phone     = typeof req.body.phone === 'string' && req.body.phone.trim() ? req.body.phone.trim() : undefined;
  const label     = parseLabel(req.body.label);
  const isDefault = req.body.isDefault === true || req.body.isDefault === 'true';

  sendSuccess(res, await addressStore.create(userId, { fullName, phone, address, city, label, isDefault }), 'Address created.', 201);
});

// The owner is looked up from the address itself so the default-address bookkeeping stays per user
const updateAddress = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'address id');
  const existing = await requireAddress(id);

  const form: Record<string, unknown> = {};
  if (req.body.fullName !== undefined) form.fullName = requireString(req.body.fullName, 'fullName');
  if (req.body.address  !== undefined) form.address  = requireString(req.body.address,  'address');
  if (req.body.city     !== undefined) form.city     = requireString(req.body.city,     'city');
  if (req.body.phone    !== undefined) {
    form.phone = typeof req.body.phone === 'string' && req.body.phone.trim() ? req.body.phone.trim() : null;
  }
  if (req.body.label     !== undefined) form.label     = parseLabel(req.body.label);
  if (req.body.isDefault !== undefined) form.isDefault = req.body.isDefault === true || req.body.isDefault === 'true';
  if (Object.keys(form).length === 0) throw new AppError('at least one field is required to update', 400);

  const updated = await addressStore.update(id, existing.userId, form);
  if (!updated) throw new AppError(`Address ${id} not found`, 404);
  sendSuccess(res, updated, 'Address updated.');
});

const deleteAddress = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'address id');
  const existing = await requireAddress(id);
  const deleted = await addressStore.delete(id, existing.userId);
  if (!deleted) throw new AppError(`Address ${id} not found`, 404);
  sendSuccess(res, deleted, 'Address deleted.');
});

// ── Routes ───────────────────────────────────────────────────────────────────

const adminRoutes = (app: Application) => {
  // One guard chain for the whole namespace: token → DB role check → audit log
  app.use('/admin', verifyAuthToken, requireAdmin, auditAdmin);

  app.get('/admin/users',              listUsers);
  app.post('/admin/users',             createUser);
  app.get('/admin/users/:id',          showUser);
  app.put('/admin/users/:id',          updateUser);
  app.put('/admin/users/:id/role',     updateUserRole);
  app.delete('/admin/users/:id',       deleteUser);

  app.get('/admin/orders',             listOrders);
  app.post('/admin/orders',            createOrder);
  app.get('/admin/orders/:id',         showOrder);
  app.put('/admin/orders/:id',         updateOrder);
  app.delete('/admin/orders/:id',      deleteOrder);
  app.get('/admin/orders/:id/products',  listOrderProducts);
  app.post('/admin/orders/:id/products', addOrderProduct);

  app.get('/admin/carts',              listCartItems);
  app.get('/admin/carts/:userId',      showUserCart);
  app.post('/admin/carts/:userId',     addUserCartItem);
  app.delete('/admin/carts/:userId',   clearUserCart);
  app.get('/admin/cart-items/:id',     showCartItem);
  app.put('/admin/cart-items/:id',     updateCartItem);
  app.delete('/admin/cart-items/:id',  deleteCartItem);

  app.get('/admin/addresses',          listAddresses);
  app.post('/admin/addresses',         createAddress);
  app.get('/admin/addresses/:id',      showAddress);
  app.put('/admin/addresses/:id',      updateAddress);
  app.delete('/admin/addresses/:id',   deleteAddress);
};

export default adminRoutes;
