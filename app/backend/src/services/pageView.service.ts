import { config } from '../config';
import { PageViewRepository } from '../repositories/pageView.repository';
import { Page, Pagination } from '../types/pagination.types';
import { NewPageView, PageView, PageViewFilters } from '../types/pageView.types';
import { pageOf } from '../utils/paging';

const pageViews = new PageViewRepository();

export function recordPageView(view: NewPageView): Promise<void> {
  return pageViews.create(view);
}

export function listPageViews(filters: PageViewFilters, page: Pagination): Promise<Page<PageView>> {
  return pageOf(
    () => pageViews.index(filters, page),
    () => pageViews.count(filters),
  );
}

export function purgeExpiredPageViews(): Promise<number> {
  return pageViews.deleteOlderThan(config.pageViewRetentionDays);
}
