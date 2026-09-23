import { Request, Response } from 'express';
import { addressUpdateSchema, newAddressSchema } from '../schemas/address.schema';
import { idParams } from '../schemas/common.schema';
import * as addressService from '../services/address.service';
import { asyncHandler } from '../utils/asyncHandler';
import { currentUserId } from '../utils/request';
import { sendSuccess } from '../utils/response';
import { parse } from '../utils/validation';

export const index = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await addressService.listForUser(currentUserId(req)), 'Addresses fetched.');
});

export const show = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parse(idParams, req.params);
  sendSuccess(res, await addressService.getForUser(id, currentUserId(req)), 'Address fetched.');
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const form = parse(newAddressSchema, req.body);
  sendSuccess(res, await addressService.createForUser(currentUserId(req), form), 'Address created.', 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parse(idParams, req.params);
  const changes = parse(addressUpdateSchema, req.body);
  sendSuccess(res, await addressService.updateForUser(id, currentUserId(req), changes), 'Address updated.');
});

export const destroy = asyncHandler(async (req: Request, res: Response) => {
  const { id } = parse(idParams, req.params);
  sendSuccess(res, await addressService.deleteForUser(id, currentUserId(req)), 'Address deleted.');
});
