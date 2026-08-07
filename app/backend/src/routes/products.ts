import { Request, Response, Router } from 'express';
import { Product } from '../types/product.types';
import { ProductStore } from '../models/product';
import { verifyAuthToken } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError, sendSuccess } from '../utils/response';
import {
  parseId,
  requireString,
  optionalString,
  requireNonNegativeNumber,
  optionalNonNegativeNumber,
  optionalNonNegativeInt,
} from '../utils/validate';

const store = new ProductStore();

/** Fields copied through as-is when present (JSON columns are validated by the database). */
const PASSTHROUGH_FIELDS = ['category', 'image', 'description', 'previewImg', 'types', 'reviews', 'isActive', 'shopId', 'shopName'] as const;

/**
 * Validate and normalize a product payload. In 'create' mode name and price
 * are mandatory; in 'update' mode every field is optional and only the
 * provided ones are returned. `label` prefixes error messages for bulk items.
 */
function parseProductPayload(source: Record<string, unknown>, mode: 'create' | 'update', label = ''): Partial<Product> {
  const key = (field: string) => (label ? `${label}.${field}` : field);
  const product: Partial<Product> = {};

  const name = mode === 'create'
    ? requireString(source.name, key('name'))
    : optionalString(source.name, key('name'));
  if (name !== undefined) product.name = name;

  const price = mode === 'create'
    ? requireNonNegativeNumber(source.price, key('price'))
    : optionalNonNegativeNumber(source.price, key('price'));
  if (price !== undefined) product.price = price;

  if (source.overallRating !== undefined)
    product.overallRating = optionalNonNegativeNumber(source.overallRating, key('overallRating'));
  if (source.stock !== undefined)
    product.stock = optionalNonNegativeInt(source.stock, key('stock'));

  for (const field of PASSTHROUGH_FIELDS) {
    if (source[field] !== undefined) (product as Record<string, unknown>)[field] = source[field];
  }

  return product;
}

const index = asyncHandler(async (req: Request, res: Response) => {
  const category = req.query.category as string | undefined;
  sendSuccess(res, category ? await store.getByCategory(category) : await store.index(), 'Products fetched.');
});

const show = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'product id');
  const product = await store.show(id);
  if (!product) throw new AppError(`product with id ${req.params.id} not found`, 404);
  sendSuccess(res, product, 'Product fetched.');
});

const mostPopular = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await store.mostPopular(), 'Most popular products fetched.');
});

const create = asyncHandler(async (req: Request, res: Response) => {
  const product = parseProductPayload(req.body, 'create') as Product;
  sendSuccess(res, await store.create(product), 'Product created.', 201);
});

const update = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'product id');

  const changes = parseProductPayload(req.body, 'update');
  if (Object.keys(changes).length === 0)
    throw new AppError('at least one field is required to update', 400);

  const updatedProduct = await store.update(id, changes);
  if (!updatedProduct) throw new AppError(`product with id ${req.params.id} not found`, 404);
  sendSuccess(res, updatedProduct, 'Product updated.');
});

const destroy = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'product id');
  const deleted = await store.delete(id);
  if (!deleted) throw new AppError(`product with id ${req.params.id} not found`, 404);
  sendSuccess(res, deleted, 'Product deleted.');
});

const bulkCreate = asyncHandler(async (req: Request, res: Response) => {
  if (!Array.isArray(req.body))
    throw new AppError('request body must be an array of products', 400);
  if (req.body.length === 0)
    throw new AppError('products array must not be empty', 400);

  const products = req.body.map(
    (item: Record<string, unknown>, index: number) => parseProductPayload(item, 'create', `products[${index}]`) as Product
  );

  sendSuccess(res, await store.bulkCreate(products), `${products.length} products created.`, 201);
});

const productsRouter = Router();

productsRouter.get('/', verifyAuthToken, index);
productsRouter.get('/popular', mostPopular);
productsRouter.get('/:id', show);
productsRouter.post('/', verifyAuthToken, create);
productsRouter.post('/bulk', verifyAuthToken, bulkCreate);
productsRouter.put('/:id', verifyAuthToken, update);
productsRouter.delete('/:id', verifyAuthToken, destroy);

export default productsRouter;
