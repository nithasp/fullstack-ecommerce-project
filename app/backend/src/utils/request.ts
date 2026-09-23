import { Request } from 'express';
import { AuditSource } from '../types/auditLog.types';
import { AppError } from './errors';

// Every authenticated route runs behind verifyAuthToken; this keeps the id it verified as the only
// source of "who is asking", so a body or query value can never stand in for it (OWASP API1)
export function currentUserId(req: Request): number {
  if (!req.user) throw new AppError('Access denied. No token provided.', 401, 'no_token');
  return req.user.userId;
}

export function requestSource(req: Request): AuditSource {
  return {
    method: req.method,
    path: req.originalUrl.split('?')[0],
    ipAddress: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
  };
}
