import { config } from '../config';
import { PageViewRepository } from '../repositories/pageView.repository';
import { Pagination } from '../types/pagination.types';
import { NewPageView, PageView, PageViewFilters } from '../types/pageView.types';

const pageViews = new PageViewRepository();

export function recordPageView(view: NewPageView): Promise<void> {
  return pageViews.create(view);
}

export async function listPageViews(
  filters: PageViewFilters,
  page: Pagination,
): Promise<{ items: PageView[]; total: number }> {
  const [items, total] = await Promise.all([pageViews.index(filters, page), pageViews.count(filters)]);
  return { items, total };
}

export function purgeExpiredPageViews(): Promise<number> {
  return pageViews.deleteOlderThan(config.pageViewRetentionDays);
}
