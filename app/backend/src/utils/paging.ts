import { Page } from '../types/pagination.types';

export async function pageOf<T>(list: () => Promise<T[]>, count: () => Promise<number>): Promise<Page<T>> {
  const [items, total] = await Promise.all([list(), count()]);
  return { items, total };
}
