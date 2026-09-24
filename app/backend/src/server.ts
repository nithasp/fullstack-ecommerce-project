import app from './app';
import { config } from './config';
import pool from './database';
import { logger } from './logger';
import { auditService, pageViewService } from './services';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SHUTDOWN_TIMEOUT_MS = 10_000;

const server = app.listen(config.port, () => logger.info({ port: config.port }, 'server listening'));

function purgeOldRows(): void {
  auditService
    .purgeExpiredAuditLogs()
    .then((deleted) => {
      if (deleted) logger.info({ deleted, days: config.auditLogRetentionDays }, 'audit log rows deleted');
    })
    .catch((err: unknown) => logger.error({ err }, 'audit log cleanup failed'));

  pageViewService
    .purgeExpiredPageViews()
    .then((deleted) => {
      if (deleted) logger.info({ deleted, days: config.pageViewRetentionDays }, 'page view rows deleted');
    })
    .catch((err: unknown) => logger.error({ err }, 'page view cleanup failed'));
}

purgeOldRows();
const purgeTimer = setInterval(purgeOldRows, ONE_DAY_MS);
purgeTimer.unref();

let stopping = false;

async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  logger.info({ signal }, 'shutting down');

  clearInterval(purgeTimer);
  const force = setTimeout(() => {
    logger.error('shutdown took too long, exiting');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  force.unref();

  await new Promise<void>((resolve) => server.close(() => resolve()));
  await auditService.flushAuditLog();
  await pool.end();

  clearTimeout(force);
  logger.info('shutdown complete');
}

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    shutdown(signal).catch((err: unknown) => {
      logger.error({ err }, 'shutdown failed');
      process.exit(1);
    });
  });
}

function crash(err: unknown, reason: string): void {
  logger.fatal({ err }, reason);
  shutdown(reason)
    .catch((shutdownErr: unknown) => logger.error({ err: shutdownErr }, 'shutdown after crash failed'))
    .finally(() => process.exit(1));
}

process.on('uncaughtException', (err) => crash(err, 'uncaught exception'));
process.on('unhandledRejection', (err) => crash(err, 'unhandled rejection'));
