import { Request } from 'express';
import { UserRole } from './user.types';

export const AUDIT_ACTIONS = [
  'CREATE',
  'READ',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'LOGIN_FAILED',
  'LOGOUT',
  'REGISTER',
  'SECURITY',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_RESULTS = ['success', 'failure'] as const;

export type AuditResult = (typeof AUDIT_RESULTS)[number];

// Small, non-secret facts about one event, e.g. { productId: 5, quantity: 2 } or { changed: ['password'] }
export type AuditDetails = Record<string, string | number | boolean | string[]>;

export type AuditDetailsFn = (req: Request) => AuditDetails | undefined;

export interface AuditRule {
  method: string;
  pattern: RegExp;
  event: string | null;
  details?: AuditDetailsFn;
}

export interface AuditSource {
  method?: string | null;
  path?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface NewAuditLog extends AuditSource {
  userId?: number | null;
  username?: string | null;
  userRole?: UserRole | null;
  action: AuditAction;
  event: string;
  statusCode?: number | null;
  details?: AuditDetails | null;
}

export type AuditAnnotation = Pick<
  NewAuditLog,
  'action' | 'event' | 'userId' | 'username' | 'userRole' | 'details'
>;

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
