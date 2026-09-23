import { z } from 'zod';
import { ORDER_STATUSES } from '../types/order.types';
import { nullableText, positiveInt } from './common.schema';

export const orderStatusSchema = z.enum(ORDER_STATUSES, {
  error: `must be one of: ${ORDER_STATUSES.join(', ')}`,
});

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
  quantity: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() !== '' ? Number(value) : value),
    z
      .number('must be a whole number between 1 and 999')
      .int('must be a whole number between 1 and 999')
      .min(1, 'must be a whole number between 1 and 999')
      .max(999, 'must be a whole number between 1 and 999'),
  ),
  typeId: nullableText(255).optional(),
});

export type NewOrderInput = z.infer<typeof newOrderSchema>;
export type NewOrderLineInput = z.infer<typeof newOrderLineSchema>;
