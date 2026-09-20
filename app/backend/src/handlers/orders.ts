import { Application, Request, Response } from 'express';
import { Order, ORDER_STATUSES, OrderStatus } from '../types/order.types';
import { OrderStore } from '../models/order';
import { verifyAuthToken } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { requireSelf, isAdmin } from '../utils/authorize';
import { AppError, sendSuccess } from '../utils/response';
import { parseId, requirePositiveInt } from '../utils/validate';

const store = new OrderStore();

export function parseOrderStatus(val: unknown, label = 'status'): OrderStatus {
  if (typeof val !== 'string' || !ORDER_STATUSES.includes(val as OrderStatus))
    throw new AppError(`${label} must be either 'active' or 'complete'`, 400);
  return val as OrderStatus;
}

// Another user's order is reported as not found so its existence isn't revealed; admins can reach any order
const requireOwnOrder = async (req: Request, id: number): Promise<Order> => {
  const order = await store.show(id);
  if (!order || (order.userId !== req.user!.userId && !isAdmin(req)))
    throw new AppError(`order with id ${id} not found`, 404);
  return order;
};

const index = asyncHandler(async (req: Request, res: Response) => {
  const status = req.query.status ? parseOrderStatus(req.query.status, 'status filter') : undefined;

  // Customers always see their own orders; an admin may filter by any userId (all orders live under /admin/orders)
  let userId = req.user!.userId;
  const userIdParam = req.query.userId as string | undefined;
  if (userIdParam) {
    const requested = parseId(userIdParam, 'userId filter');
    requireSelf(req, requested);
    userId = requested;
  }

  sendSuccess(res, await store.index({ status, userId }), 'Orders fetched.');
});

const show = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'order id');
  sendSuccess(res, await requireOwnOrder(req, id), 'Order fetched.');
});

const create = asyncHandler(async (req: Request, res: Response) => {
  let userId = req.user!.userId;
  if (req.body.userId !== undefined) {
    const requested = requirePositiveInt(req.body.userId, 'userId');
    requireSelf(req, requested);
    userId = requested;
  }

  const status = req.body.status ? parseOrderStatus(req.body.status) : 'active';
  sendSuccess(res, await store.create({ userId, status }), 'Order created.', 201);
});

const update = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'order id');
  await requireOwnOrder(req, id);
  if (!req.body.status) throw new AppError('status is required', 400);
  const updatedOrder = await store.update(id, parseOrderStatus(req.body.status));
  if (!updatedOrder) throw new AppError(`order with id ${req.params.id} not found`, 404);
  sendSuccess(res, updatedOrder, 'Order updated.');
});

const destroy = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'order id');
  await requireOwnOrder(req, id);
  const deleted = await store.delete(id);
  if (!deleted) throw new AppError(`order with id ${req.params.id} not found`, 404);
  sendSuccess(res, deleted, 'Order deleted.');
});

const getOrderProducts = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'order id');
  await requireOwnOrder(req, id);
  sendSuccess(res, await store.getOrderProducts(id), 'Order products fetched.');
});

const currentOrderByUser = asyncHandler(async (req: Request, res: Response) => {
  const userId = parseId(req.params.userId, 'userId');
  requireSelf(req, userId);
  sendSuccess(res, await store.index({ status: 'active', userId }), 'Current order fetched.');
});

const completedOrdersByUser = asyncHandler(async (req: Request, res: Response) => {
  const userId = parseId(req.params.userId, 'userId');
  requireSelf(req, userId);
  sendSuccess(res, await store.index({ status: 'complete', userId }), 'Completed orders fetched.');
});

const addProduct = asyncHandler(async (req: Request, res: Response) => {
  const orderId   = parseId(req.params.id, 'order id in URL');
  await requireOwnOrder(req, orderId);
  const productId = requirePositiveInt(req.body.productId, 'productId');
  const quantity  = requirePositiveInt(req.body.quantity, 'quantity');

  sendSuccess(res, await store.addProduct({ orderId, productId, quantity }), 'Product added to order.');
});

const orderRoutes = (app: Application) => {
  app.get('/orders', verifyAuthToken, index);
  app.get('/orders/user/:userId/current',   verifyAuthToken, currentOrderByUser);
  app.get('/orders/user/:userId/completed', verifyAuthToken, completedOrdersByUser);
  app.get('/orders/:id/products',           verifyAuthToken, getOrderProducts);
  app.post('/orders/:id/products',          verifyAuthToken, addProduct);
  app.get('/orders/:id',                    verifyAuthToken, show);
  app.post('/orders',                       verifyAuthToken, create);
  app.put('/orders/:id',                    verifyAuthToken, update);
  app.delete('/orders/:id',                 verifyAuthToken, destroy);
};

export default orderRoutes;
