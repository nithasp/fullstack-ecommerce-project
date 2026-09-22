import { Request, Response } from 'express';
import { OrderRepository } from '../repositories/order.repository';
import { Order, OrderStatus } from '../types/order.types';
import { asyncHandler } from '../utils/asyncHandler';
import { isAdmin, requireSelf } from '../utils/authorize';
import { AppError, sendPage, sendSuccess } from '../utils/response';
import { parseId, parseOrderStatus, parsePagination, requirePositiveInt } from '../utils/validate';

const orders = new OrderRepository();

// Another user's order is reported as not found so its existence isn't revealed; admins can reach any order
const requireOwnOrder = async (req: Request, id: number): Promise<Order> => {
  const order = await orders.show(id);
  if (!order || (order.userId !== req.user!.userId && !isAdmin(req)))
    throw new AppError(`order with id ${id} not found`, 404);
  return order;
};

const sendOrderPage = async (
  req: Request, res: Response, userId: number, status: OrderStatus | undefined, message: string
): Promise<void> => {
  const page = parsePagination(req.query);
  const filters = { status, userId };
  const [items, total] = await Promise.all([orders.index(filters, page), orders.count(filters)]);
  sendPage(res, items, { ...page, total }, message);
};

export const index = asyncHandler(async (req: Request, res: Response) => {
  const status = req.query.status ? parseOrderStatus(req.query.status, 'status filter') : undefined;

  // Customers always see their own orders; an admin may filter by any userId (all orders live under /admin/orders)
  let userId = req.user!.userId;
  const userIdParam = req.query.userId as string | undefined;
  if (userIdParam) {
    const requested = parseId(userIdParam, 'userId filter');
    requireSelf(req, requested);
    userId = requested;
  }

  await sendOrderPage(req, res, userId, status, 'Orders fetched.');
});

export const show = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'order id');
  sendSuccess(res, await requireOwnOrder(req, id), 'Order fetched.');
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  let userId = req.user!.userId;
  if (req.body.userId !== undefined) {
    const requested = requirePositiveInt(req.body.userId, 'userId');
    requireSelf(req, requested);
    userId = requested;
  }

  const status = req.body.status ? parseOrderStatus(req.body.status) : 'active';
  sendSuccess(res, await orders.create({ userId, status }), 'Order created.', 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'order id');
  await requireOwnOrder(req, id);
  if (!req.body.status) throw new AppError('status is required', 400);
  const updatedOrder = await orders.update(id, parseOrderStatus(req.body.status));
  if (!updatedOrder) throw new AppError(`order with id ${req.params.id} not found`, 404);
  sendSuccess(res, updatedOrder, 'Order updated.');
});

export const destroy = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'order id');
  await requireOwnOrder(req, id);
  const deleted = await orders.delete(id);
  if (!deleted) throw new AppError(`order with id ${req.params.id} not found`, 404);
  sendSuccess(res, deleted, 'Order deleted.');
});

export const getOrderProducts = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'order id');
  await requireOwnOrder(req, id);
  sendSuccess(res, await orders.getOrderProducts(id), 'Order products fetched.');
});

export const currentOrderByUser = asyncHandler(async (req: Request, res: Response) => {
  const userId = parseId(req.params.userId, 'userId');
  requireSelf(req, userId);
  await sendOrderPage(req, res, userId, 'active', 'Current order fetched.');
});

export const completedOrdersByUser = asyncHandler(async (req: Request, res: Response) => {
  const userId = parseId(req.params.userId, 'userId');
  requireSelf(req, userId);
  await sendOrderPage(req, res, userId, 'complete', 'Completed orders fetched.');
});

export const addProduct = asyncHandler(async (req: Request, res: Response) => {
  const orderId   = parseId(req.params.id, 'order id in URL');
  await requireOwnOrder(req, orderId);
  const productId = requirePositiveInt(req.body.productId, 'productId');
  const quantity  = requirePositiveInt(req.body.quantity, 'quantity');

  sendSuccess(res, await orders.addProduct({ orderId, productId, quantity }), 'Product added to order.');
});
