import { Request, Response } from 'express';
import { idParams, paginationSchema } from '../../schemas/common.schema';
import {
  bulkProductsSchema,
  newProductSchema,
  productFiltersSchema,
  productUpdateSchema,
} from '../../schemas/product.schema';
import * as productService from '../../services/product.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { parse } from '../../utils/validation';

export const index = asyncHandler(async (req: Request, res: Response) => {
  const filters = parse(productFiltersSchema, req.query);
  const page = parse(paginationSchema, req.query);
  const { items, total } = await productService.listAllProducts(filters, page);
  sendSuccess(res, items, 'Products fetched.', 200, { ...page, total });
});

export const show = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parse(idParams, req.params);
  sendSuccess(res, await productService.getAnyProduct(id), 'Product fetched.');
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = parse(newProductSchema, req.body);
  sendSuccess(res, await productService.createProduct(input), 'Product created.', 201);
});

export const bulkCreate = asyncHandler(async (req: Request, res: Response) => {
  const inputs = parse(bulkProductsSchema, req.body);
  sendSuccess(res, await productService.createProducts(inputs), `${inputs.length} products created.`, 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parse(idParams, req.params);
  const changes = parse(productUpdateSchema, req.body);
  sendSuccess(res, await productService.updateProduct(id, changes), 'Product updated.');
});

export const archive = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parse(idParams, req.params);
  sendSuccess(res, await productService.archiveProduct(id), 'Product archived.');
});
