import { Request, Response } from 'express';
import { CartRepository } from '../repositories/cart.repository';
import { checkout as placeOrder } from '../services/checkout.service';
import { CheckoutItem } from '../types/cart.types';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError, sendSuccess } from '../utils/response';
import { parseCartItemPayload, parseId, requirePositiveInt } from '../utils/validate';

const cart = new CartRepository();

export const getCart = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await cart.getByUser(req.user!.userId), 'Cart fetched.');
});

export const addItem = asyncHandler(async (req: Request, res: Response) => {
  const item = await cart.upsert(req.user!.userId, parseCartItemPayload(req.body));
  sendSuccess(res, item, 'Item added to cart.', 201);
});

export const updateItem = asyncHandler(async (req: Request, res: Response) => {
  const userId     = req.user!.userId;
  const cartItemId = parseId(req.params.id, 'cart item id');
  const quantity   = requirePositiveInt(req.body.quantity, 'quantity');

  const updated = await cart.updateQuantity(cartItemId, userId, quantity);
  if (!updated) throw new AppError(`Cart item ${cartItemId} not found`, 404);

  sendSuccess(res, updated, 'Cart item updated.');
});

export const removeItem = asyncHandler(async (req: Request, res: Response) => {
  const userId     = req.user!.userId;
  const cartItemId = parseId(req.params.id, 'cart item id');

  const deleted = await cart.remove(cartItemId, userId);
  if (!deleted) throw new AppError(`Cart item ${cartItemId} not found`, 404);

  sendSuccess(res, deleted, 'Cart item removed.');
});

export const clearCart = asyncHandler(async (req: Request, res: Response) => {
  await cart.clearByUser(req.user!.userId);
  sendSuccess(res, null, 'Cart cleared.');
});

export const checkout = asyncHandler(async (req: Request, res: Response) => {
  const items: unknown = req.body.items;
  if (!Array.isArray(items) || items.length === 0)
    throw new AppError('items must be a non-empty array', 400);

  const checkoutItems: CheckoutItem[] = items.map((item) => ({
    productId: requirePositiveInt(item?.productId, 'productId'),
    quantity:  requirePositiveInt(item?.quantity,  'quantity'),
  }));

  const order = await placeOrder(req.user!.userId, checkoutItems);
  sendSuccess(res, { order }, 'Checkout successful.', 201);
});
