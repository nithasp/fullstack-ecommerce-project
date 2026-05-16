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

const bulkCreate = asyncHandler(async (req: Request, res: Response) => {
  if (!Array.isArray(req.body))
    throw new AppError('request body must be an array of products', 400);
  if (req.body.length === 0)
    throw new AppError('products array must not be empty', 400);

  const products: Product[] = req.body.map((item: Record<string, unknown>, index: number) => {
    const name = requireString(item.name as string, `products[${index}].name`);
    if (item.price === undefined || item.price === null || isNaN(Number(item.price)))
      throw new AppError(`products[${index}].price is required and must be a valid number`, 400);
    if (Number(item.price) < 0)
      throw new AppError(`products[${index}].price must be a non-negative number`, 400);
    return {
      name,
      price: parseFloat(item.price as string),
      category: item.category as string | undefined,
      image: item.image as string | undefined,
      description: item.description as string | undefined,
      previewImg: item.previewImg as string[] | undefined,
      types: item.types as Product['types'],
      reviews: item.reviews as Product['reviews'],
      overallRating: item.overallRating !== undefined ? parseFloat(item.overallRating as string) : undefined,
      stock: item.stock !== undefined ? parseInt(item.stock as string) : undefined,
      isActive: item.isActive as boolean | undefined,
      shopId: item.shopId as string | undefined,
      shopName: item.shopName as string | undefined,
    };
  });

  sendSuccess(res, await store.bulkCreate(products), `${products.length} products created.`, 201);
});

const productRoutes = (app: Application) => {
  app.get('/products', verifyAuthToken, index);
  app.get('/products/popular', mostPopular);
  app.get('/products/:id', show);
  app.post('/products', verifyAuthToken, create);
  app.post('/products/bulk', verifyAuthToken, bulkCreate);
  app.put('/products/:id', verifyAuthToken, update);
  app.delete('/products/:id', verifyAuthToken, destroy);
};

export default productRoutes;
