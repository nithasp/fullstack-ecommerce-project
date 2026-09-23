import pino from 'pino';
import { config } from './config';

// Credentials must never reach the log, whatever a request carries (OWASP API8)
const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.currentPassword',
  '*.newPassword',
  '*.refreshToken',
  '*.accessToken',
];

export const logger = pino({
  level: config.logLevel,
  redact: { paths: REDACTED_PATHS, remove: true },
  base: undefined,
  transport: config.prettyLogs
    ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
    : undefined,
});
