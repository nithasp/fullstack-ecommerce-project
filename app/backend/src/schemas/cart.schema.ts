import { z } from 'zod';
import { MAX_CART_QUANTITY } from '../types/cart.types';
import { nullableText, positiveInt, wholeNumber } from './common.schema';

const quantity = wholeNumber(1, MAX_CART_QUANTITY);

// The chosen option is named by id only; its price and stock are read from the product, never
// taken from the request (OWASP API3)
export const addCartItemSchema = z.object({
  productId: positiveInt,
  quantity: quantity.default(1),
  typeId: nullableText(255).optional(),
});

export const cartQuantitySchema = z.object({ quantity });

export const checkoutSchema = z.object({
  cartItemIds: z
    .array(positiveInt, 'must be a list of cart item ids')
    .min(1, 'must hold at least one cart item')
    .max(100, 'must hold at most 100 cart items'),
  addressId: positiveInt,
});

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
