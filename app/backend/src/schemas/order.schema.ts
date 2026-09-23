import { z } from 'zod';
import { MAX_CART_QUANTITY } from '../types/cart.types';
import { ORDER_STATUSES } from '../types/order.types';
import { nullableText, positiveInt, wholeNumber } from './common.schema';

export const orderStatusSchema = z.enum(ORDER_STATUSES, {
  error: `must be one of: ${ORDER_STATUSES.join(', ')}`,
});

export const customerOrderFiltersSchema = z.object({ status: orderStatusSchema.optional() });

export const orderFiltersSchema = z.object({
  status: orderStatusSchema.optional(),
  userId: positiveInt.optional(),
});

export const newOrderSchema = z.object({
  userId: positiveInt,
  status: orderStatusSchema.default('active'),
});

export const orderStatusUpdateSchema = z.object({ status: orderStatusSchema });

export const newOrderLineSchema = z.object({
  productId: positiveInt,
  quantity: wholeNumber(1, MAX_CART_QUANTITY),
  typeId: nullableText(255).optional(),
});

export type NewOrderInput = z.infer<typeof newOrderSchema>;
export type NewOrderLineInput = z.infer<typeof newOrderLineSchema>;
