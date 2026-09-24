export interface NewPageView {
  userId: number;
  username: string | null;
  path: string;
  page: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface PageView {
  id: number;
  createdAt: Date;
  userId: number | null;
  username: string | null;
  path: string;
  page: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface PageViewFilters {
  userId?: number | undefined;
  username?: string | undefined;
  path?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
}
