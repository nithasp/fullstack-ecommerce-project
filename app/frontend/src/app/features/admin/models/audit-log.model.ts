import { UserRole } from '../../../core/models/auth.model';

// Security-relevant events only. Pages people opened are analytics and live in their own list.
export type AuditAction =
  'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGIN_FAILED' | 'LOGOUT' | 'REGISTER' | 'SECURITY';

// Every type the backend records, in the order the type filter lists them
export const AUDIT_ACTIONS: AuditAction[] = [
  'CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'REGISTER', 'SECURITY',
];

// success: any status below 400; failure: 400 and above
export type AuditResult = 'success' | 'failure';

export interface AuditLog {
  id: number;
  createdAt: string;
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
  details: Record<string, string | number | boolean | string[]> | null;
}

export interface AuditLogQuery {
  limit: number;
  offset: number;
  userId?: number;
  username?: string;
  actions?: AuditAction[];
  result?: AuditResult;
  from?: string; // ISO 8601
  to?: string;   // ISO 8601, exclusive
}
