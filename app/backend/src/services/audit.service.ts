import { config } from '../config';
import { logger } from '../logger';
import { AuditLogRepository } from '../repositories/auditLog.repository';
import { AuditLog, AuditLogFilters, NewAuditLog } from '../types/auditLog.types';
import { Page, Pagination } from '../types/pagination.types';
import { pageOf } from '../utils/paging';

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

export function listAuditLogs(filters: AuditLogFilters, page: Pagination): Promise<Page<AuditLog>> {
  return pageOf(
    () => auditLogs.index(filters, page),
    () => auditLogs.count(filters),
  );
}

export function purgeExpiredAuditLogs(): Promise<number> {
  return auditLogs.deleteOlderThan(config.auditLogRetentionDays);
}
