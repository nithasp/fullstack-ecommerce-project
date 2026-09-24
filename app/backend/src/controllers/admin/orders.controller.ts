import { Request, Response } from 'express';
import { idParams, paginationSchema } from '../../schemas/common.schema';
import {
  newOrderLineSchema,
  newOrderSchema,
  orderFiltersSchema,
  orderStatusUpdateSchema,
} from '../../schemas/order.schema';
import { orderService, userService } from '../../services';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { parse } from '../../utils/validation';

export const index = asyncHandler(async (req: Request, res: Response) => {
  const filters = parse(orderFiltersSchema, req.query);
  const page = parse(paginationSchema, req.query);
  const { items, total } = await orderService.listOrders(filters, page);
  sendSuccess(res, items, 'Orders fetched.', 200, { ...page, total });
});

export const show = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parse(idParams, req.params);
  sendSuccess(res, await orderService.getOrder(id), 'Order fetched.');
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { userId, status } = parse(newOrderSchema, req.body);
  await userService.requireUser(userId);
  sendSuccess(res, await orderService.createOrder(userId, status), 'Order created.', 201);
});

export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parse(idParams, req.params);
  const { status } = parse(orderStatusUpdateSchema, req.body);
  sendSuccess(res, await orderService.updateStatus(id, status), 'Order updated.');
});

export const destroy = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parse(idParams, req.params);
  sendSuccess(res, await orderService.deleteOrder(id), 'Order deleted.');
});

export const lines = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parse(idParams, req.params);
  await orderService.getOrder(id);
  sendSuccess(res, await orderService.getLines(id), 'Order products fetched.');
});

export const addLine = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parse(idParams, req.params);
  const input = parse(newOrderLineSchema, req.body);
  await orderService.getOrder(id);
  sendSuccess(res, await orderService.addLine(id, input), 'Product added to order.', 201);
});
