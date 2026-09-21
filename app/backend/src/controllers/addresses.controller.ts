import { Request, Response } from 'express';
import { AddressRepository } from '../repositories/address.repository';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError, sendSuccess } from '../utils/response';
import { parseAddressUpdate, parseId, parseNewAddress } from '../utils/validate';

const addresses = new AddressRepository();

export const getAddresses = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await addresses.getByUser(req.user!.userId), 'Addresses fetched.');
});

export const getAddress = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'address id');
  const address = await addresses.show(id, req.user!.userId);
  if (!address) throw new AppError(`Address ${id} not found`, 404);
  sendSuccess(res, address, 'Address fetched.');
});

export const createAddress = asyncHandler(async (req: Request, res: Response) => {
  const created = await addresses.create(req.user!.userId, parseNewAddress(req.body));
  sendSuccess(res, created, 'Address created.', 201);
});

export const updateAddress = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const id = parseId(req.params.id, 'address id');

  const updated = await addresses.update(id, userId, parseAddressUpdate(req.body));
  if (!updated) throw new AppError(`Address ${id} not found`, 404);

  sendSuccess(res, updated, 'Address updated.');
});

export const deleteAddress = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, 'address id');
  const deleted = await addresses.delete(id, req.user!.userId);
  if (!deleted) throw new AppError(`Address ${id} not found`, 404);
  sendSuccess(res, deleted, 'Address deleted.');
});
