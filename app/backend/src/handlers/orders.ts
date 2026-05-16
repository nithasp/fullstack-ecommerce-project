import { Application, Request, Response } from 'express';
import { OrderStore } from '../models/order';
import { verifyAuthToken } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError, sendSuccess } from '../utils/response';
import { parseId, requirePositiveInt } from '../utils/validate';

const store = new OrderStore();

const index = asyncHandler(async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  if (status && !['active', 'complete'].includes(status))
    throw new AppError("status filter must be either 'active' or 'complete'", 400);

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

  if (req.body.status && !['active', 'complete'].includes(req.body.status))
    throw new AppError("status must be either 'active' or 'complete'", 400);

  sendSuccess(res, await store.create({ userId, status: req.body.status || 'active' }), 'Order created.', 201);
});

const update = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'order id');
  if (!req.body.status) throw new AppError('status is required', 400);
  if (!['active', 'complete'].includes(req.body.status))
    throw new AppError("status must be either 'active' or 'complete'", 400);

  const updatedOrder = await store.update(id, req.body.status);
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
