import { Request } from 'express';
import { config } from '../config';
import { logger } from '../logger';
import { AuditLogRepository } from '../repositories/auditLog.repository';
import { AuditLog, AuditLogFilters, AuditSource, NewAuditLog } from '../types/auditLog.types';
import { Pagination } from '../types/pagination.types';

const auditLogs = new AuditLogRepository();

const pendingWrites = new Set<Promise<void>>();

export function recordEvent(entry: NewAuditLog): void {
  const write: Promise<void> = auditLogs
    .create(entry)
    .catch((err: unknown) => logger.error({ err, event: entry.event }, 'could not save audit entry'))
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

export async function listAuditLogs(
  filters: AuditLogFilters,
  page: Pagination,
): Promise<{ items: AuditLog[]; total: number }> {
  const [items, total] = await Promise.all([auditLogs.index(filters, page), auditLogs.count(filters)]);
  return { items, total };
}

export function purgeExpiredAuditLogs(): Promise<number> {
  return auditLogs.deleteOlderThan(config.auditLogRetentionDays);
}
