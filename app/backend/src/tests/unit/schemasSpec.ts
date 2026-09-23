import { paginationSchema } from '../../schemas/common.schema';
import { pageViewSchema } from '../../schemas/pageView.schema';
import { newProductSchema } from '../../schemas/product.schema';
import { AppError } from '../../utils/errors';
import { parse } from '../../utils/validation';

function problem(schema: Parameters<typeof parse>[0], input: unknown): string {
  try {
    parse(schema, input);
    return 'no error';
  } catch (err) {
    return err instanceof AppError ? err.message : String(err);
  }
}

describe('Request schemas', () => {
  describe('pagination', () => {
    it('fills in the defaults', () => {
      expect(parse(paginationSchema, {})).toEqual({ limit: 50, offset: 0 });
    });

    it('takes numbers written as text', () => {
      expect(parse(paginationSchema, { limit: '10', offset: '20' })).toEqual({ limit: 10, offset: 20 });
    });

    it('keeps a page within bounds', () => {
      expect(problem(paginationSchema, { limit: 0 })).toContain(
        'limit must be a whole number between 1 and 100',
      );
      expect(problem(paginationSchema, { limit: 500 })).toContain('limit');
      expect(problem(paginationSchema, { offset: -1 })).toContain('offset');
      expect(problem(paginationSchema, { limit: 'all' })).toContain('limit');
    });
  });

  describe('products', () => {
    const base = { name: 'Thing', price: 10 };

    it('accepts a price written as a number or as text', () => {
      expect(parse(newProductSchema, { ...base, price: '19.99' }).price).toBe(19.99);
      expect(parse(newProductSchema, { ...base, price: 19.99 }).price).toBe(19.99);
    });

    it('refuses a price that is not an amount', () => {
      for (const price of ['', ' ', 'free', true, null, [], {}, 19.999, -1]) {
        expect(problem(newProductSchema, { ...base, price })).toContain('price');
      }
    });

    it('refuses options that are not a list of options', () => {
      for (const types of [
        'oops',
        {},
        [null],
        [{ color: 'Red' }],
        [{ color: 'Red', price: 'free', stock: 1 }],
      ]) {
        expect(problem(newProductSchema, { ...base, types })).toContain('types');
      }
    });

    it('accepts a well-formed option and fills in its stock', () => {
      const product = parse(newProductSchema, { ...base, types: [{ _id: 'a', color: 'Red', price: 1.5 }] });
      expect(product.types[0]).toEqual({ _id: 'a', color: 'Red', price: 1.5, stock: 0 });
    });

    it('fills in the defaults of a bare product', () => {
      const product = parse(newProductSchema, base);
      expect(product).toEqual(
        jasmine.objectContaining({
          previewImg: [],
          types: [],
          reviews: [],
          overallRating: 0,
          stock: 0,
          isActive: true,
        }),
      );
    });

    it('drops fields it does not know', () => {
      const product = parse(newProductSchema, { ...base, id: 99, isAdmin: true }) as Record<string, unknown>;
      expect(product.id).toBeUndefined();
      expect(product.isAdmin).toBeUndefined();
    });

    it('refuses a rating outside 0 to 5 and a negative stock', () => {
      expect(problem(newProductSchema, { ...base, overallRating: 9 })).toContain('overallRating');
      expect(problem(newProductSchema, { ...base, stock: -1 })).toContain('stock');
    });
  });

  describe('page views', () => {
    it('takes a page path', () => {
      expect(parse(pageViewSchema, { path: '/products/5', page: 'Product detail' }).path).toBe('/products/5');
    });

    it('refuses anything that is not a page path', () => {
      for (const path of ['products', 'https://example.com/x', '/products?q=1', '/a#b', '', '/with space']) {
        expect(problem(pageViewSchema, { path })).toContain('path');
      }
    });
  });

  describe('error messages', () => {
    it('names the field that was wrong, including inside a list', () => {
      expect(problem(newProductSchema, { price: 10 })).toBe('name is required');
      expect(problem(newProductSchema, { name: 'x', price: 1, types: [{ color: 'Red' }] })).toBe(
        'types[0].price must be an amount such as 19.99',
      );
    });
  });
});
