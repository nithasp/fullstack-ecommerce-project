import { config } from '../config';
import { Page, Pagination } from '../types/pagination.types';
import { NewPageView, PageView, PageViewFilters } from '../types/pageView.types';
import { PageViewServiceDeps } from '../types/service.types';
import { pageOf } from '../utils/paging';

export function createPageViewService({ pageViews }: PageViewServiceDeps) {
  return {
    recordPageView(view: NewPageView): Promise<void> {
      return pageViews.create(view);
    },

    listPageViews(filters: PageViewFilters, page: Pagination): Promise<Page<PageView>> {
      return pageOf(
        () => pageViews.index(filters, page),
        () => pageViews.count(filters),
      );
    },

    purgeExpiredPageViews(): Promise<number> {
      return pageViews.deleteOlderThan(config.pageViewRetentionDays);
    },
  };
}

export type PageViewService = ReturnType<typeof createPageViewService>;
