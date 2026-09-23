import { Request, Response } from 'express';
import { z } from 'zod';
import { addCartItemSchema, cartQuantitySchema } from '../../schemas/cart.schema';
import { idParams, paginationSchema, positiveInt } from '../../schemas/common.schema';
import * as cartService from '../../services/cart.service';
import { requireUser } from '../../services/user.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendPage, sendSuccess } from '../../utils/response';
import { parse } from '../../utils/validation';

const userIdParams = z.object({ userId: positiveInt });
const userIdFilter = z.object({ userId: positiveInt.optional() });

export const index = asyncHandler(async (req: Request, res: Response) => {
  const filters = parse(userIdFilter, req.query);
  const page = parse(paginationSchema, req.query);
  const { items, total } = await cartService.listAllCartItems(filters, page);
  sendPage(res, items, { ...page, total }, 'Cart items fetched.');
});

export const showUserCart = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = parse(userIdParams, req.params);
  await requireUser(userId);
  sendSuccess(res, await cartService.getCart(userId), 'Cart fetched.');
});

export const addUserCartItem = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = parse(userIdParams, req.params);
  const input = parse(addCartItemSchema, req.body);
  await requireUser(userId);
  sendSuccess(res, await cartService.addItem(userId, input), 'Item added to cart.', 201);
});

export const clearUserCart = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = parse(userIdParams, req.params);
  await requireUser(userId);
  await cartService.clearCart(userId);
  sendSuccess(res, null, 'Cart cleared.');
});

export const showItem = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parse(idParams, req.params);
  sendSuccess(res, await cartService.getCartItem(id), 'Cart item fetched.');
});

export const updateItem = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parse(idParams, req.params);
  const { quantity } = parse(cartQuantitySchema, req.body);
  sendSuccess(res, await cartService.updateQuantityById(id, quantity), 'Cart item updated.');
});

export const removeItem = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parse(idParams, req.params);
  sendSuccess(res, await cartService.removeById(id), 'Cart item removed.');
});
