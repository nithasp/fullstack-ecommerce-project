import { Request, Response, Router } from 'express';
import { OrderStore } from '../models/order';
import { ORDER_STATUSES, OrderStatus, isOrderStatus } from '../types/order.types';
import { verifyAuthToken } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError, sendSuccess } from '../utils/response';
import { parseId, requirePositiveInt } from '../utils/validate';

const store = new OrderStore();

const STATUS_LIST = ORDER_STATUSES.map((status) => `'${status}'`).join(' or ');

/** Validate an optional status value, e.g. from a query string or request body. */
function parseOrderStatus(val: unknown, label: string): OrderStatus | undefined {
  if (val === undefined) return undefined;
  if (!isOrderStatus(val)) throw new AppError(`${label} must be either ${STATUS_LIST}`, 400);
  return val;
}

const index = asyncHandler(async (req: Request, res: Response) => {
  const status = parseOrderStatus(req.query.status, 'status filter');

  const userIdParam = req.query.userId as string | undefined;
  const userId = userIdParam ? parseId(userIdParam, 'userId filter') : undefined;

  sendSuccess(res, await store.index({ status, userId }), 'Orders fetched.');
});

const show = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'order id');
  const order = await store.show(id);
  if (!order) throw new AppError(`order with id ${req.params.id} not found`, 404);
  sendSuccess(res, order, 'Order fetched.');
});

const create = asyncHandler(async (req: Request, res: Response) => {
  const userId = requirePositiveInt(req.body.userId, 'userId');
  const status = parseOrderStatus(req.body.status || undefined, 'status') ?? 'active';

  sendSuccess(res, await store.create({ userId, status }), 'Order created.', 201);
});

const update = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'order id');
  if (!req.body.status) throw new AppError('status is required', 400);
  const status = parseOrderStatus(req.body.status, 'status') as OrderStatus;

  const updatedOrder = await store.update(id, status);
  if (!updatedOrder) throw new AppError(`order with id ${req.params.id} not found`, 404);
  sendSuccess(res, updatedOrder, 'Order updated.');
});

const destroy = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'order id');
  const deleted = await store.delete(id);
  if (!deleted) throw new AppError(`order with id ${req.params.id} not found`, 404);
  sendSuccess(res, deleted, 'Order deleted.');
});

const getOrderProducts = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'order id');
  sendSuccess(res, await store.getOrderProducts(id), 'Order products fetched.');
});

const currentOrderByUser = asyncHandler(async (req: Request, res: Response) => {
  const userId = parseId(req.params.userId, 'userId');
  sendSuccess(res, await store.index({ status: 'active', userId }), 'Current order fetched.');
});

const completedOrdersByUser = asyncHandler(async (req: Request, res: Response) => {
  const userId = parseId(req.params.userId, 'userId');
  sendSuccess(res, await store.index({ status: 'complete', userId }), 'Completed orders fetched.');
});

const addProduct = asyncHandler(async (req: Request, res: Response) => {
  const orderId   = parseId(req.params.id, 'order id in URL');
  const productId = requirePositiveInt(req.body.productId, 'productId');
  const quantity  = requirePositiveInt(req.body.quantity, 'quantity');

  sendSuccess(res, await store.addProduct({ orderId, productId, quantity }), 'Product added to order.');
});

const ordersRouter = Router();
ordersRouter.use(verifyAuthToken);

ordersRouter.get('/', index);
ordersRouter.get('/user/:userId/current', currentOrderByUser);
ordersRouter.get('/user/:userId/completed', completedOrdersByUser);
ordersRouter.get('/:id/products', getOrderProducts);
ordersRouter.post('/:id/products', addProduct);
ordersRouter.get('/:id', show);
ordersRouter.post('/', create);
ordersRouter.put('/:id', update);
ordersRouter.delete('/:id', destroy);

export default ordersRouter;
