import { Request, Response } from 'express';
import { idParams, paginationSchema } from '../schemas/common.schema';
import { productFiltersSchema } from '../schemas/product.schema';
import { productService } from '../services';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { parse } from '../utils/validation';

export const index = asyncHandler(async (req: Request, res: Response) => {
  const filters = parse(productFiltersSchema, req.query);
  const page = parse(paginationSchema, req.query);
  const { items, total } = await productService.listCatalog(filters, page);
  sendSuccess(res, items, 'Products fetched.', 200, { ...page, total });
});

export const categories = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await productService.listCategories(), 'Categories fetched.');
});

export const mostPopular = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await productService.listMostPopular(), 'Most popular products fetched.');
});

export const show = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parse(idParams, req.params);
  sendSuccess(res, await productService.getCatalogProduct(id), 'Product fetched.');
});
