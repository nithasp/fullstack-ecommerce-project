import { Request } from 'express';
import { config } from '../config';
import { AuditLogRepository } from '../repositories/auditLog.repository';
import { AuditSource, NewAuditLog } from '../types/auditLog.types';

/**
 * Writing to the audit log. Nothing here makes a caller wait: a row is saved in the background,
 * and a write that fails is reported on the console and dropped. Losing one log row is better
 * than failing the user's request over it.
 */

const auditLogs = new AuditLogRepository();

// Writes still in flight, so flushAuditLog() can wait for them
const pendingWrites = new Set<Promise<void>>();

export function recordEvent(entry: NewAuditLog): void {
  const write: Promise<void> = auditLogs
    .create(entry)
    .catch((err) => console.error(`[audit] could not save ${entry.event}`, err))
    .finally(() => pendingWrites.delete(write));
  pendingWrites.add(write);
}

// Resolves once every event recorded so far is saved; tests call it before reading the log back
export async function flushAuditLog(): Promise<void> {
  // A response's 'finish' handler may still be queued behind the caller; let it run so its write counts
  await new Promise((resolve) => setImmediate(resolve));
  await Promise.all(pendingWrites);
}

// The query string is left off the path; the filters worth keeping go into a row's details instead
export function requestSource(req: Request): AuditSource {
  return {
    method: req.method,
    path: req.originalUrl.split('?')[0],
    ipAddress: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
  };
}

// Deletes rows past the retention period (AUDIT_LOG_RETENTION_DAYS, 90 by default); returns how many
export function purgeExpiredAuditLogs(): Promise<number> {
  return auditLogs.deleteOlderThan(config.auditLogRetentionDays);
}
