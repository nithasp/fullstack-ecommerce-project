import { z } from 'zod';
import { optionalText, positiveInt, searchText } from './common.schema';

const MAX_PATH_LENGTH = 255;

export const pageViewSchema = z.object({
  path: z
    .string('is required')
    .trim()
    .min(1, 'is required')
    .max(MAX_PATH_LENGTH, `must be at most ${MAX_PATH_LENGTH} characters`)
    .regex(/^\/[^\s?#]*$/, 'must be a page path such as /products/5'),
  page: optionalText(60),
});

export const pageViewFiltersSchema = z.object({
  userId: positiveInt.optional(),
  username: searchText,
  path: searchText,
  from: z.coerce.date('must be a date, e.g. 2026-09-22T00:00:00Z').optional(),
  to: z.coerce.date('must be a date, e.g. 2026-09-22T00:00:00Z').optional(),
});

export type PageViewInput = z.infer<typeof pageViewSchema>;
