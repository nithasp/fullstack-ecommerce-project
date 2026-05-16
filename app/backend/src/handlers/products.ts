import { Application, Request, Response } from 'express';
import { Product } from '../types/product.types';
import { ProductStore } from '../models/product';
import { verifyAuthToken } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError, sendSuccess } from '../utils/response';
import { parseId, requireString, optionalString } from '../utils/validate';

const store = new ProductStore();

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
  const name = requireString(req.body.name, 'name');

  if (req.body.price === undefined || req.body.price === null || isNaN(Number(req.body.price)))
    throw new AppError('price is required and must be a valid number', 400);
  if (Number(req.body.price) < 0)
    throw new AppError('price must be a non-negative number', 400);

  const product: Product = {
    name,
    price: parseFloat(req.body.price),
    category: req.body.category,
    image: req.body.image,
    description: req.body.description,
    previewImg: req.body.previewImg,
    types: req.body.types,
    reviews: req.body.reviews,
    overallRating: req.body.overallRating !== undefined ? parseFloat(req.body.overallRating) : undefined,
    stock: req.body.stock !== undefined ? parseInt(req.body.stock) : undefined,
    isActive: req.body.isActive,
    shopId: req.body.shopId,
    shopName: req.body.shopName,
  };

  sendSuccess(res, await store.create(product), 'Product created.', 201);
});

const update = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'product id');
  const {
    name, price, category, image, description,
    previewImg, types, reviews, overallRating, stock, isActive,
    shopId, shopName,
  } = req.body;

  if (!name && price === undefined && category === undefined &&
      image === undefined && description === undefined &&
      previewImg === undefined && types === undefined &&
      reviews === undefined && overallRating === undefined &&
      stock === undefined && isActive === undefined &&
      shopId === undefined && shopName === undefined)
    throw new AppError('at least one field is required to update', 400);

  const validatedName = optionalString(name, 'name');

  if (price !== undefined) {
    if (isNaN(Number(price))) throw new AppError('price must be a valid number', 400);
    if (Number(price) < 0) throw new AppError('price must be a non-negative number', 400);
  }

  const updatedProduct = await store.update(id, {
    name: validatedName,
    price: price !== undefined ? parseFloat(price) : undefined,
    category,
    image,
    description,
    previewImg,
    types,
    reviews,
    overallRating: overallRating !== undefined ? parseFloat(overallRating) : undefined,
    stock: stock !== undefined ? parseInt(stock) : undefined,
    isActive,
    shopId,
    shopName,
  });
  if (!updatedProduct) throw new AppError(`product with id ${req.params.id} not found`, 404);
  sendSuccess(res, updatedProduct, 'Product updated.');
});

const destroy = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'product id');
  const deleted = await store.delete(id);
  if (!deleted) throw new AppError(`product with id ${req.params.id} not found`, 404);
  sendSuccess(res, deleted, 'Product deleted.');
});

const productRoutes = (app: Application) => {
  app.get('/products', verifyAuthToken, index);
  app.get('/products/popular', mostPopular);
  app.get('/products/:id', show);
  app.post('/products', verifyAuthToken, create);
  app.put('/products/:id', verifyAuthToken, update);
  app.delete('/products/:id', verifyAuthToken, destroy);
};

export default productRoutes;
