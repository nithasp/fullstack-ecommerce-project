import { z } from 'zod';
import { ADDRESS_LABELS } from '../types/address.types';
import { nullableText, positiveInt, requiredText } from './common.schema';

const boolish = z.preprocess(
  (value) => (value === 'true' ? true : value === 'false' ? false : value),
  z.boolean('must be true or false'),
);

const addressShape = {
  fullName: requiredText(255),
  phone: nullableText(50),
  address: requiredText(2000),
  city: requiredText(255),
  label: z.enum(ADDRESS_LABELS, { error: `must be one of: ${ADDRESS_LABELS.join(', ')}` }),
  isDefault: boolish,
};

export const newAddressSchema = z.object({
  ...addressShape,
  phone: addressShape.phone.optional(),
  label: addressShape.label.default('home'),
  isDefault: addressShape.isDefault.default(false),
});

export const addressUpdateSchema = z
  .object(addressShape)
  .partial()
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    error: 'at least one field is required to update',
  });

export const adminNewAddressSchema = newAddressSchema.extend({ userId: positiveInt });

export type NewAddressInput = z.infer<typeof newAddressSchema>;
export type AddressUpdateInput = z.infer<typeof addressUpdateSchema>;
