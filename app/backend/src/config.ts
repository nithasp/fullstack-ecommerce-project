import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const MIN_SECRET_LENGTH = 32;
const DAY_MS = 24 * 60 * 60 * 1000;

const secret = z.string().min(MIN_SECRET_LENGTH, `must be at least ${MIN_SECRET_LENGTH} characters`);

const envSchema = z
  .object({
    ENV: z.enum(['dev', 'test', 'production']).default('dev'),
    NODE_ENV: z.string().optional(),
    PORT: z.coerce.number().int().positive().default(3000),
    ALLOWED_ORIGIN: z.string().default('http://localhost:4200'),
    JSON_BODY_LIMIT: z.string().default('1mb'),
    TRUST_PROXY: z.coerce.number().int().min(0).default(1),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),

    API_RATE_LIMIT: z.coerce.number().int().positive().default(500),
    AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(20),

    TOKEN_SECRET: secret,
    ACCESS_TOKEN_EXPIRY: z.string().default('15m'),
    REFRESH_TOKEN_EXPIRY_DAYS: z.coerce.number().int().positive().max(365).default(7),

    PASSWORD_PEPPER: secret,
    BCRYPT_PASSWORD: z.string().optional(),
    SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(10),

    AUDIT_LOG_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
    PAGE_VIEW_RETENTION_DAYS: z.coerce.number().int().positive().default(90),

    DATABASE_URL: z.string().optional(),
    POSTGRES_HOST: z.string().default('127.0.0.1'),
    POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
    POSTGRES_DB: z.string().default('storefront_dev'),
    POSTGRES_TEST_DB: z.string().default('storefront_test'),
    POSTGRES_USER: z.string().optional(),
    POSTGRES_PASSWORD: z.string().optional(),
    DATABASE_SSL: z.enum(['off', 'no-verify', 'verify']).optional(),
    DATABASE_SSL_CA: z.string().optional(),

    ADMIN_USERNAME: z.string().optional(),
    ADMIN_PASSWORD: z.string().optional(),
    ADMIN_FIRST_NAME: z.string().optional(),
    ADMIN_LAST_NAME: z.string().optional(),
  })
  .refine((env) => env.DATABASE_URL || (env.POSTGRES_USER && env.POSTGRES_PASSWORD), {
    error: 'set DATABASE_URL, or POSTGRES_USER and POSTGRES_PASSWORD',
    path: ['DATABASE_URL'],
  });

// An unset or unusable value stops the process here rather than falling back to a default that
// would weaken authentication or the database connection (OWASP API8)
function readEnv(): z.infer<typeof envSchema> {
  const present = Object.fromEntries(
    Object.entries(process.env).filter(([, value]) => value !== undefined && value !== ''),
  );

  const parsed = envSchema.safeParse(present);
  if (!parsed.success) {
    const problems = parsed.error.issues.map(
      (issue) => `  ${issue.path.join('.') || 'env'}: ${issue.message}`,
    );
    throw new Error(`[config] The environment is not usable:\n${problems.join('\n')}`);
  }
  return parsed.data;
}

const env = readEnv();

const sslMode = env.DATABASE_SSL ?? (env.DATABASE_URL ? 'verify' : 'off');

export const config = {
  env: env.ENV,
  isProduction: env.ENV === 'production',
  isTest: env.ENV === 'test',
  port: env.PORT,
  allowedOrigins: env.ALLOWED_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  jsonBodyLimit: env.JSON_BODY_LIMIT,
  trustProxy: env.TRUST_PROXY,
  logLevel: env.LOG_LEVEL ?? (env.ENV === 'test' ? 'silent' : 'info'),
  prettyLogs: env.ENV === 'dev' && env.NODE_ENV !== 'production',

  apiRateLimit: env.API_RATE_LIMIT,
  authRateLimit: env.AUTH_RATE_LIMIT,

  tokenSecret: env.TOKEN_SECRET,
  accessTokenExpiry: env.ACCESS_TOKEN_EXPIRY,
  refreshTokenExpiryMs: env.REFRESH_TOKEN_EXPIRY_DAYS * DAY_MS,

  passwordPepper: env.PASSWORD_PEPPER,
  legacyPasswordPepper: env.BCRYPT_PASSWORD,
  saltRounds: env.SALT_ROUNDS,

  auditLogRetentionDays: env.AUDIT_LOG_RETENTION_DAYS,
  pageViewRetentionDays: env.PAGE_VIEW_RETENTION_DAYS,

  database: {
    url: env.DATABASE_URL,
    host: env.POSTGRES_HOST,
    port: env.POSTGRES_PORT,
    name: env.ENV === 'test' ? env.POSTGRES_TEST_DB : env.POSTGRES_DB,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    sslMode,
    sslCa: env.DATABASE_SSL_CA,
  },

  // The browser keeps the refresh token in a cookie JavaScript cannot read, so an XSS bug in the
  // frontend cannot steal a session; it is sent only to the auth routes (OWASP API2)
  refreshCookie: {
    name: 'refreshToken',
    path: '/api/v1/auth',
    sameSite: 'strict' as const,
    httpOnly: true,
    secure: env.ENV === 'production',
    maxAgeMs: env.REFRESH_TOKEN_EXPIRY_DAYS * DAY_MS,
  },

  adminSeed: {
    username: env.ADMIN_USERNAME,
    password: env.ADMIN_PASSWORD,
    firstName: env.ADMIN_FIRST_NAME,
    lastName: env.ADMIN_LAST_NAME,
  },
};
