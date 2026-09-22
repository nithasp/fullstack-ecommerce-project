import { Request } from 'express';
import { config } from '../config';
import { AuditLogRepository } from '../repositories/auditLog.repository';
import { AuditSource, NewAuditLog } from '../types/auditLog.types';

const auditLogs = new AuditLogRepository();

const pendingWrites = new Set<Promise<void>>();

export function recordEvent(entry: NewAuditLog): void {
  const write: Promise<void> = auditLogs
    .create(entry)
    .catch((err) => console.error(`[audit] could not save ${entry.event}`, err))
    .finally(() => pendingWrites.delete(write));
  pendingWrites.add(write);
}

export async function flushAuditLog(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
  await Promise.all(pendingWrites);
}

export function requestSource(req: Request): AuditSource {
  return {
    method: req.method,
    path: req.originalUrl.split('?')[0],
    ipAddress: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
  };
}

export function purgeExpiredAuditLogs(): Promise<number> {
  return auditLogs.deleteOlderThan(config.auditLogRetentionDays);
}
