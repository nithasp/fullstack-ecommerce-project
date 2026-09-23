export interface PageView {
  id: number;
  createdAt: string;
  userId: number | null;
  username: string | null;
  path: string;
  page: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface PageViewQuery {
  limit: number;
  offset: number;
  userId?: number;
  username?: string;
  path?: string;
  from?: string; // ISO 8601
  to?: string;   // ISO 8601, exclusive
}
