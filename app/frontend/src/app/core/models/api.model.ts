/**
 * Standard envelope returned by every API endpoint.
 *
 * Success:  { status: 200, message: '...', data: T }
 * Failure:  { status: 4xx | 5xx, message: '...', data: null }
 * Paginated lists add `meta`: { status: 200, message: '...', data: T[], meta: { limit, offset, total } }
 *
 * The auth interceptor unwraps this automatically, so services and components
 * always receive the inner `data` payload directly — no per-service mapping needed.
 */
export interface ApiResponse<T> {
  status: number;
  message: string;
  data: T;
  meta?: PageMeta;
}

export interface PageMeta {
  limit: number;
  offset: number;
  total: number;
}

/** One page of a list, plus how many items the whole list holds. */
export interface Page<T> {
  items: T[];
  total: number;
}
