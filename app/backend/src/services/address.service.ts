import { withTransaction } from '../database';
import { Address, AddressFilters, AddressUpdate, NewAddress } from '../types/address.types';
import { Tx } from '../types/database.types';
import { Page, Pagination } from '../types/pagination.types';
import { AddressServiceDeps } from '../types/service.types';
import { AppError } from '../utils/errors';
import { pageOf } from '../utils/paging';

const notFound = (id: number) => new AppError(`Address ${id} not found`, 404, 'not_found');

export function createAddressService({ addresses }: AddressServiceDeps) {
  async function applyUpdate(existing: Address, changes: AddressUpdate, tx: Tx): Promise<Address> {
    if (changes.isDefault === true) await addresses.clearDefault(existing.userId, tx);

    const updated = await addresses.update(existing.id, changes, tx);
    if (!updated) throw notFound(existing.id);

    if (changes.isDefault === false && existing.isDefault) {
      await addresses.makeOldestDefault(existing.userId, tx);
      return (await addresses.findById(existing.id, tx)) ?? updated;
    }
    return updated;
  }

  async function applyDelete(existing: Address, tx: Tx): Promise<Address> {
    await addresses.delete(existing.id, tx);
    if (existing.isDefault) await addresses.makeOldestDefault(existing.userId, tx);
    return existing;
  }

  return {
    listForUser(userId: number): Promise<Address[]> {
      return addresses.listByUser(userId);
    },

    async getForUser(id: number, userId: number): Promise<Address> {
      const address = await addresses.findForUser(id, userId);
      if (!address) throw notFound(id);
      return address;
    },

    listAll(filters: AddressFilters, page: Pagination): Promise<Page<Address>> {
      return pageOf(
        () => addresses.listAll(filters, page),
        () => addresses.count(filters),
      );
    },

    async getById(id: number): Promise<Address> {
      const address = await addresses.findById(id);
      if (!address) throw notFound(id);
      return address;
    },

    createForUser(userId: number, form: NewAddress): Promise<Address> {
      return withTransaction(async (tx) => {
        const existing = await addresses.countForUser(userId, tx);
        const isDefault = form.isDefault || existing === 0;
        if (isDefault) await addresses.clearDefault(userId, tx);
        return addresses.create(userId, form, isDefault, tx);
      });
    },

    updateForUser(id: number, userId: number, changes: AddressUpdate): Promise<Address> {
      return withTransaction(async (tx) => {
        const existing = await addresses.findForUser(id, userId, tx);
        if (!existing) throw notFound(id);
        return applyUpdate(existing, changes, tx);
      });
    },

    updateById(id: number, changes: AddressUpdate): Promise<Address> {
      return withTransaction(async (tx) => {
        const existing = await addresses.findById(id, tx);
        if (!existing) throw notFound(id);
        return applyUpdate(existing, changes, tx);
      });
    },

    deleteForUser(id: number, userId: number): Promise<Address> {
      return withTransaction(async (tx) => {
        const existing = await addresses.findForUser(id, userId, tx);
        if (!existing) throw notFound(id);
        return applyDelete(existing, tx);
      });
    },

    deleteById(id: number): Promise<Address> {
      return withTransaction(async (tx) => {
        const existing = await addresses.findById(id, tx);
        if (!existing) throw notFound(id);
        return applyDelete(existing, tx);
      });
    },
  };
}

export type AddressService = ReturnType<typeof createAddressService>;
