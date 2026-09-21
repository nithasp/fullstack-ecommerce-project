export interface Pagination {
  limit: number;
  offset: number;
}

// Sent next to `data` on every paginated list so a client can tell whether more pages exist
export interface PageMeta extends Pagination {
  total: number;
}
