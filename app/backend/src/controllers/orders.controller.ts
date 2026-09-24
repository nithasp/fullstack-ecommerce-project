import { Request, Response } from 'express';
import { idParams, paginationSchema } from '../schemas/common.schema';
import { customerOrderFiltersSchema } from '../schemas/order.schema';
import { orderService } from '../services';
import { asyncHandler } from '../utils/asyncHandler';
import { currentUserId } from '../utils/request';
import { sendSuccess } from '../utils/response';
import { parse } from '../utils/validation';

export const index = asyncHandler(async (req: Request, res: Response) => {
  const { status } = parse(customerOrderFiltersSchema, req.query);
  const page = parse(paginationSchema, req.query);
  const { items, total } = await orderService.listOrders({ status, userId: currentUserId(req) }, page);
  sendSuccess(res, items, 'Orders fetched.', 200, { ...page, total });
});

export const show = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parse(idParams, req.params);
  sendSuccess(res, await orderService.getOwnOrder(id, currentUserId(req)), 'Order fetched.');
});

export const lines = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parse(idParams, req.params);
  await orderService.getOwnOrder(id, currentUserId(req));
  sendSuccess(res, await orderService.getLines(id), 'Order products fetched.');
});
