import { Request, Response } from 'express';
import { ProductRepository } from '../repositories/product.repository';
import { Product } from '../types/product.types';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError, sendPage, sendSuccess } from '../utils/response';
import {
  optionalString, parseId, parsePagination, parseProductFilters, requireString,
} from '../utils/validate';

const products = new ProductRepository();

function parseNewProduct(item: Record<string, unknown>, prefix = ''): Product {
  const name = requireString(item.name, `${prefix}name`);

  if (item.price === undefined || item.price === null || isNaN(Number(item.price)))
    throw new AppError(`${prefix}price is required and must be a valid number`, 400);
  if (Number(item.price) < 0)
    throw new AppError(`${prefix}price must be a non-negative number`, 400);

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
}

export const index = asyncHandler(async (req: Request, res: Response) => {
  const filters = parseProductFilters(req.query);
  const page = parsePagination(req.query);
  const [items, total] = await Promise.all([products.index(filters, page), products.count(filters)]);
  sendPage(res, items, { ...page, total }, 'Products fetched.');
});

export const categories = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await products.categories(), 'Categories fetched.');
});

export const show = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'product id');
  const product = await products.show(id);
  if (!product) throw new AppError(`product with id ${req.params.id} not found`, 404);
  sendSuccess(res, product, 'Product fetched.');
});

export const mostPopular = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await products.mostPopular(), 'Most popular products fetched.');
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await products.create(parseNewProduct(req.body)), 'Product created.', 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
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

  const updatedProduct = await products.update(id, {
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

export const destroy = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'product id');
  const deleted = await products.delete(id);
  if (!deleted) throw new AppError(`product with id ${req.params.id} not found`, 404);
  sendSuccess(res, deleted, 'Product deleted.');
});

export const bulkCreate = asyncHandler(async (req: Request, res: Response) => {
  if (!Array.isArray(req.body))
    throw new AppError('request body must be an array of products', 400);
  if (req.body.length === 0)
    throw new AppError('products array must not be empty', 400);

  const items: Product[] = req.body.map((item: unknown, index: number) => {
    if (!item || typeof item !== 'object')
      throw new AppError(`products[${index}] must be an object`, 400);
    return parseNewProduct(item as Record<string, unknown>, `products[${index}].`);
  });

  sendSuccess(res, await products.bulkCreate(items), `${items.length} products created.`, 201);
});
