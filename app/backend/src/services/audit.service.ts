import { config } from '../config';
import { logger } from '../logger';
import { AuditLog, AuditLogFilters, NewAuditLog } from '../types/auditLog.types';
import { Page, Pagination } from '../types/pagination.types';
import { AuditServiceDeps } from '../types/service.types';
import { pageOf } from '../utils/paging';

export function createAuditService({ auditLogs }: AuditServiceDeps) {
  const pendingWrites = new Set<Promise<void>>();

  return {
    recordEvent(entry: NewAuditLog): void {
      const write: Promise<void> = auditLogs
        .create(entry)
        .catch((err: unknown) => logger.error({ err, event: entry.event }, 'could not save audit entry'))
        .finally(() => pendingWrites.delete(write));
      pendingWrites.add(write);
    },

    async flushAuditLog(): Promise<void> {
      await new Promise((resolve) => setImmediate(resolve));
      await Promise.all(pendingWrites);
    },

    listAuditLogs(filters: AuditLogFilters, page: Pagination): Promise<Page<AuditLog>> {
      return pageOf(
        () => auditLogs.index(filters, page),
        () => auditLogs.count(filters),
      );
    },

    purgeExpiredAuditLogs(): Promise<number> {
      return auditLogs.deleteOlderThan(config.auditLogRetentionDays);
    },
  };
}

export type AuditService = ReturnType<typeof createAuditService>;
