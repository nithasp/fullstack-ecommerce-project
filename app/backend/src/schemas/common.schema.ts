import { z } from 'zod';

export const PAGINATION_DEFAULT_LIMIT = 50;
export const PAGINATION_MAX_LIMIT = 100;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_QUERY_STRING_LENGTH = 100;

const WHOLE_NUMBER = 'must be a whole number greater than 0';

const asNumber = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() !== '' ? Number(value) : value;

export const positiveInt = z.preprocess(
  asNumber,
  z.number(WHOLE_NUMBER).int(WHOLE_NUMBER).positive(WHOLE_NUMBER),
);

export const nonNegativeInt = z.preprocess(
  asNumber,
  z
    .number('must be a whole number of 0 or more')
    .int('must be a whole number of 0 or more')
    .nonnegative('must be a whole number of 0 or more'),
);

export const money = z.preprocess(
  asNumber,
  z
    .number('must be an amount such as 19.99')
    .min(0, 'must be 0 or more')
    .max(99999999.99, 'must be at most 99999999.99')
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, {
      error: 'must have at most two decimal places',
    }),
);

export const requiredText = (max: number) =>
  z.string('is required').trim().min(1, 'is required').max(max, `must be at most ${max} characters`);

export const optionalText = (max: number) => requiredText(max).optional();

export const nullableText = (max: number) =>
  z
    .union([z.string().trim().max(max, `must be at most ${max} characters`), z.null()])
    .transform((value) => (value === null || value === '' ? null : value));

export const password = z
  .string('is required')
  .min(MIN_PASSWORD_LENGTH, `must be at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(128, 'must be at most 128 characters');

export const idParams = z.object({ id: positiveInt });

// Bounded page size so a single list request can't pull the whole table (OWASP API4)
export const paginationSchema = z.object({
  limit: z
    .preprocess(
      asNumber,
      z
        .number(`must be a whole number between 1 and ${PAGINATION_MAX_LIMIT}`)
        .int(`must be a whole number between 1 and ${PAGINATION_MAX_LIMIT}`)
        .min(1, `must be a whole number between 1 and ${PAGINATION_MAX_LIMIT}`)
        .max(PAGINATION_MAX_LIMIT, `must be a whole number between 1 and ${PAGINATION_MAX_LIMIT}`),
    )
    .default(PAGINATION_DEFAULT_LIMIT),
  offset: nonNegativeInt.default(0),
});

export const searchText = z
  .string('must be a single value')
  .max(MAX_QUERY_STRING_LENGTH, `must be at most ${MAX_QUERY_STRING_LENGTH} characters`)
  .transform((value) => value.trim())
  .transform((value) => (value === '' ? undefined : value))
  .optional();
