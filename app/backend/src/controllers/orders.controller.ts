import { Request, Response } from 'express';
import { idParams, paginationSchema } from '../schemas/common.schema';
import { orderStatusSchema } from '../schemas/order.schema';
import * as orderService from '../services/order.service';
import { asyncHandler } from '../utils/asyncHandler';
import { currentUserId } from '../utils/request';
import { sendPage, sendSuccess } from '../utils/response';
import { parse } from '../utils/validation';
import { z } from 'zod';

const filtersSchema = z.object({ status: orderStatusSchema.optional() });

export const index = asyncHandler(async (req: Request, res: Response) => {
  const { status } = parse(filtersSchema, req.query);
  const page = parse(paginationSchema, req.query);
  const { items, total } = await orderService.listOrders({ status, userId: currentUserId(req) }, page);
  sendPage(res, items, { ...page, total }, 'Orders fetched.');
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
