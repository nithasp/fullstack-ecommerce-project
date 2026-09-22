import app from './app';
import { config } from './config';
import { purgeExpiredAuditLogs } from './services/audit.service';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Kept apart from app.ts so tests can import the app without opening a port
app.listen(config.port, () => console.log(`Server running on port ${config.port}`));

// Audit-log rows past the retention period are deleted at startup and then once a day
const purgeAuditLog = (): void => {
  purgeExpiredAuditLogs()
    .then((deleted) => {
      if (deleted) console.info(`[audit] deleted ${deleted} rows older than ${config.auditLogRetentionDays} days`);
    })
    .catch((err) => console.error('[audit] cleanup failed', err));
};
purgeAuditLog();
setInterval(purgeAuditLog, ONE_DAY_MS).unref();
