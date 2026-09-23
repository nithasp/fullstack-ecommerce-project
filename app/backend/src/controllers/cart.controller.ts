import { Request, Response } from 'express';
import { addCartItemSchema, cartQuantitySchema, checkoutSchema } from '../schemas/cart.schema';
import { idParams } from '../schemas/common.schema';
import * as cartService from '../services/cart.service';
import { asyncHandler } from '../utils/asyncHandler';
import { currentUserId } from '../utils/request';
import { sendSuccess } from '../utils/response';
import { parse } from '../utils/validation';

export const getCart = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await cartService.getCart(currentUserId(req)), 'Cart fetched.');
});

export const addItem = asyncHandler(async (req: Request, res: Response) => {
  const input = parse(addCartItemSchema, req.body);
  sendSuccess(res, await cartService.addItem(currentUserId(req), input), 'Item added to cart.', 201);
});

export const updateItem = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parse(idParams, req.params);
  const { quantity } = parse(cartQuantitySchema, req.body);
  sendSuccess(res, await cartService.updateQuantity(currentUserId(req), id, quantity), 'Cart item updated.');
});

export const removeItem = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parse(idParams, req.params);
  sendSuccess(res, await cartService.removeItem(currentUserId(req), id), 'Cart item removed.');
});

export const clearCart = asyncHandler(async (req: Request, res: Response) => {
  await cartService.clearCart(currentUserId(req));
  sendSuccess(res, null, 'Cart cleared.');
});

export const checkout = asyncHandler(async (req: Request, res: Response) => {
  const { cartItemIds, addressId } = parse(checkoutSchema, req.body);
  const result = await cartService.checkout(currentUserId(req), cartItemIds, addressId);
  sendSuccess(res, result, 'Checkout successful.', 201);
});
