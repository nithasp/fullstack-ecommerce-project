export interface Pagination {
  limit: number;
  offset: number;
}

export interface PageMeta extends Pagination {
  total: number;
}
