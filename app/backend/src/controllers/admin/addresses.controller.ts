import { Request, Response } from 'express';
import { addressUpdateSchema, adminNewAddressSchema } from '../../schemas/address.schema';
import { idParams, paginationSchema, userIdFilterSchema } from '../../schemas/common.schema';
import * as addressService from '../../services/address.service';
import { requireUser } from '../../services/user.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { parse } from '../../utils/validation';

export const index = asyncHandler(async (req: Request, res: Response) => {
  const filters = parse(userIdFilterSchema, req.query);
  const page = parse(paginationSchema, req.query);
  const { items, total } = await addressService.listAll(filters, page);
  sendSuccess(res, items, 'Addresses fetched.', 200, { ...page, total });
});

export const show = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parse(idParams, req.params);
  sendSuccess(res, await addressService.getById(id), 'Address fetched.');
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { userId, ...form } = parse(adminNewAddressSchema, req.body);
  await requireUser(userId);
  sendSuccess(res, await addressService.createForUser(userId, form), 'Address created.', 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parse(idParams, req.params);
  const changes = parse(addressUpdateSchema, req.body);
  sendSuccess(res, await addressService.updateById(id, changes), 'Address updated.');
});

export const destroy = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parse(idParams, req.params);
  sendSuccess(res, await addressService.deleteById(id), 'Address deleted.');
});
