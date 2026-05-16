/**
 * Standard envelope returned by every API endpoint.
 *
 * Success:  { status: 200, message: '...', data: T }
 * Failure:  { status: 4xx | 5xx, message: '...', data: null }
 *
 * The auth interceptor unwraps this automatically, so services and components
 * always receive the inner `data` payload directly — no per-service mapping needed.
 */
export interface ApiResponse<T> {
  status: number;
  message: string;
  data: T;
}
