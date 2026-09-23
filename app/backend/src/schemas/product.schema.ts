import { z } from 'zod';
import { money, nonNegativeInt, nullableText, optionalText, requiredText, searchText } from './common.schema';

const rating = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() !== '' ? Number(value) : value),
  z
    .number('must be a number between 0 and 5')
    .min(0, 'must be between 0 and 5')
    .max(5, 'must be between 0 and 5'),
);

const productTypeSchema = z.object({
  _id: optionalText(64),
  productId: nonNegativeInt.optional(),
  color: requiredText(60),
  quantity: nonNegativeInt.optional(),
  price: money,
  stock: nonNegativeInt.default(0),
  image: optionalText(500),
});

const reviewSchema = z.object({
  _id: optionalText(64),
  star: rating,
  comment: optionalText(2000),
  userId: optionalText(64),
  userName: optionalText(100),
  date: optionalText(40),
});

const productShape = {
  name: requiredText(255),
  price: money,
  category: nullableText(100),
  image: nullableText(500),
  description: nullableText(5000),
  previewImg: z.array(z.string().max(500, 'must be at most 500 characters')).max(20),
  types: z.array(productTypeSchema).max(50),
  reviews: z.array(reviewSchema).max(200),
  overallRating: rating,
  stock: nonNegativeInt,
  isActive: z.boolean('must be true or false'),
  shopId: nullableText(255),
  shopName: nullableText(255),
};

export const newProductSchema = z.object({
  ...productShape,
  category: productShape.category.optional(),
  image: productShape.image.optional(),
  description: productShape.description.optional(),
  previewImg: productShape.previewImg.default([]),
  types: productShape.types.default([]),
  reviews: productShape.reviews.default([]),
  overallRating: productShape.overallRating.default(0),
  stock: productShape.stock.default(0),
  isActive: productShape.isActive.default(true),
  shopId: productShape.shopId.optional(),
  shopName: productShape.shopName.optional(),
});

export const productUpdateSchema = z
  .object(productShape)
  .partial()
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    error: 'at least one field is required to update',
  });

export const bulkProductsSchema = z
  .array(newProductSchema, 'must be an array of products')
  .min(1, 'must hold at least one product')
  .max(500, 'must hold at most 500 products');

export const productFiltersSchema = z.object({
  category: searchText,
  search: searchText,
});

export type NewProductInput = z.infer<typeof newProductSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
