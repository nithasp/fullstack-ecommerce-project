import app from './app';
import { config } from './config';
import { purgeExpiredAuditLogs } from './services/audit.service';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

app.listen(config.port, () => console.log(`Server running on port ${config.port}`));

const purgeAuditLog = (): void => {
  purgeExpiredAuditLogs()
    .then((deleted) => {
      if (deleted) console.info(`[audit] deleted ${deleted} rows older than ${config.auditLogRetentionDays} days`);
    })
    .catch((err) => console.error('[audit] cleanup failed', err));
};
purgeAuditLog();
setInterval(purgeAuditLog, ONE_DAY_MS).unref();
