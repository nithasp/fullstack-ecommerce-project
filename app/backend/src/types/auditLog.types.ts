import { UserRole } from './user.types';

// What kind of thing happened. CREATE, READ, UPDATE and DELETE come from the HTTP method of an
// ordinary request; the auth code names its own events, and PAGE_VIEW is a frontend page the
// browser reports, rather than an API call.
export const AUDIT_ACTIONS = [
  'CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'REGISTER', 'SECURITY', 'PAGE_VIEW',
] as const;

export type AuditAction = typeof AUDIT_ACTIONS[number];

// Whether the request worked: any status below 400 is a success
export const AUDIT_RESULTS = ['success', 'failure'] as const;

export type AuditResult = typeof AUDIT_RESULTS[number];

// Small, non-secret facts about one event, e.g. { productId: 5, quantity: 2 } or { changed: ['password'] }
export type AuditDetails = Record<string, string | number | boolean | string[]>;

// Where a request came from, read off the request itself. A page view has no HTTP method of its own.
export interface AuditSource {
  method?: string | null;
  path?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

// A row to write. Only one of userId and username has to be known; the repository looks up the other.
export interface NewAuditLog extends AuditSource {
  userId?: number | null;
  username?: string | null;
  userRole?: UserRole | null;
  action: AuditAction;
  event: string;
  statusCode?: number | null;
  details?: AuditDetails | null;
}

// What a handler says about its own request; who it was falls back to the token user, and the
// method and path to the request's own (a page view swaps in the page's path)
export type AuditAnnotation = Pick<NewAuditLog, 'action' | 'event' | 'userId' | 'username' | 'userRole' | 'details' | 'method' | 'path'>;

// A frontend page, as the browser reports it: its path, e.g. /products/5, and a readable name
export interface PageView {
  path: string;
  page?: string;
}

// A row as the admin API returns it
export interface AuditLog {
  id: number;
  createdAt: Date;
  userId: number | null;
  username: string | null;
  userRole: UserRole | null;
  action: AuditAction;
  event: string;
  method: string | null;
  path: string | null;
  statusCode: number | null;
  ipAddress: string | null;
  userAgent: string | null;
  details: AuditDetails | null;
}

export interface AuditLogFilters {
  userId?: number;
  username?: string;
  actions?: AuditAction[];
  result?: AuditResult;
  from?: Date;
  to?: Date;
}
