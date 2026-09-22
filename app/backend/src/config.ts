import dotenv from 'dotenv';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production' || process.env.ENV === 'production';

if (!process.env.TOKEN_SECRET) {
  if (isProduction) {
    throw new Error('[config] TOKEN_SECRET must be set as an environment variable in production.');
  }
  console.warn('[config] TOKEN_SECRET is not set — using insecure default. Set it in .env for production.');
}

export const config = {
  tokenSecret: process.env.TOKEN_SECRET || 'default-secret-for-dev',
  accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || '15m',
  refreshTokenExpiryMs: 7 * 24 * 60 * 60 * 1000,
  allowedOrigins: (process.env.ALLOWED_ORIGIN || 'http://localhost:4200')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  port: parseInt(process.env.PORT || '3000', 10),
  // Max JSON request body; the sample bulk product import is ~14 KB
  jsonBodyLimit: process.env.JSON_BODY_LIMIT || '1mb',
  // Requests per IP per 15 minutes across all routes (auth routes have their own stricter limit)
  apiRateLimit: parseInt(process.env.API_RATE_LIMIT || '500', 10),
  // Days an audit-log row is kept; older rows are deleted at startup and then once a day (server.ts)
  auditLogRetentionDays: parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '90', 10),
};
